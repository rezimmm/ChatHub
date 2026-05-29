from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, status, UploadFile, File, Query, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr, field_validator
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import json
import aiofiles
import asyncio
import secrets
import re
import html
import hmac
import hashlib
import base64

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

api_router = APIRouter(prefix="/api")

# Fix for passlib + bcrypt + Python 3.11/3.12 compatibility
# Use a custom bcrypt handle to avoid the passlib 72-byte check crash
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# This line avoids passlib's internal capability check which causes the ValueError on Python 3.11
if hasattr(pwd_context, "_cached_schemes"):
    pwd_context._get_scheme("bcrypt")
security = HTTPBearer()

# Use env var or generate a strong secret
_env_secret = os.environ.get('JWT_SECRET_KEY', '')
if not _env_secret or _env_secret == 'your-secret-key-change-in-production' or _env_secret == 'your-secret-key-change-in-production-realtime-chat-2024':
    SECRET_KEY = secrets.token_urlsafe(64)
    logging.warning("Using auto-generated JWT secret. Set JWT_SECRET_KEY in .env for persistence across restarts.")
else:
    SECRET_KEY = _env_secret

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440

UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

# Max file upload size (10MB)
MAX_FILE_SIZE = 10 * 1024 * 1024

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_channels: Dict[str, List[str]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"is_online": True, "last_seen": datetime.now(timezone.utc).isoformat()}}
        )

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        if user_id in self.user_channels:
            del self.user_channels[user_id]

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(message)
            except Exception:
                self.disconnect(user_id)

    async def broadcast_to_channel(self, message: dict, channel_id: str):
        channel = await db.channels.find_one({"id": channel_id}, {"_id": 0})
        if channel:
            for member_id in channel.get("members", []):
                await self.send_personal_message(message, member_id)

    async def broadcast_user_status(self, user_id: str, is_online: bool, user_status: str = None):
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
        if user:
            status_message = {
                "type": "user_status",
                "user_id": user_id,
                "is_online": is_online,
                "status": user_status or user.get("status", "online"),
                "last_seen": datetime.now(timezone.utc).isoformat(),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            for conn_user_id in list(self.active_connections.keys()):
                await self.send_personal_message(status_message, conn_user_id)

    async def broadcast_to_all(self, message: dict):
        for conn_user_id in list(self.active_connections.keys()):
            await self.send_personal_message(message, conn_user_id)

manager = ConnectionManager()

def sanitize_input(text: str) -> str:
    """Sanitize user input - light sanitization since frontend uses react-markdown for safe rendering"""
    if not text:
        return text
    text = text.strip()
    # Only escape angle brackets to prevent raw HTML injection
    # react-markdown handles XSS protection on the frontend
    text = text.replace('<', '&lt;').replace('>', '&gt;')
    return text

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    username: str
    is_online: bool = False
    status: str = "online"
    last_seen: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    avatar_color: str = "#7c3aed"
    avatar_url: Optional[str] = None
    bio: Optional[str] = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters')
        return v

    @field_validator('username')
    @classmethod
    def validate_username(cls, v):
        v = v.strip()
        if len(v) < 2 or len(v) > 30:
            raise ValueError('Username must be 2-30 characters')
        if not re.match(r'^[a-zA-Z0-9_\- ]+$', v):
            raise ValueError('Username can only contain letters, numbers, spaces, hyphens and underscores')
        return v

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    username: Optional[str] = None
    status: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class Reaction(BaseModel):
    emoji: str
    user_id: str
    username: str

class Message(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    channel_id: str
    user_id: str
    username: str
    content: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    avatar_color: str = "#7c3aed"
    avatar_url: Optional[str] = None
    edited: bool = False
    edited_at: Optional[str] = None
    reactions: List[Reaction] = []
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_type: Optional[str] = None
    pinned: bool = False
    reply_to: Optional[str] = None
    read_by: List[str] = []
    thread_id: Optional[str] = None
    reply_count: int = 0

class MessageCreate(BaseModel):
    channel_id: str
    content: str
    reply_to: Optional[str] = None
    thread_id: Optional[str] = None

class MessageUpdate(BaseModel):
    content: str

class MessageReaction(BaseModel):
    emoji: str

class Channel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = ""
    is_dm: bool = False
    members: List[str] = []
    created_by: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    is_favorite: List[str] = []
    is_muted: List[str] = []
    unread_count: Dict[str, int] = {}

class ChannelCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    is_dm: bool = False
    members: Optional[List[str]] = []

class ChannelUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class ChannelMemberAction(BaseModel):
    user_id: str

class InviteLink(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    channel_id: str
    created_by: str
    token: str = ""
    expires_at: Optional[str] = None
    max_uses: Optional[int] = None
    use_count: int = 0
    is_active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class InviteCreate(BaseModel):
    expires_in_hours: Optional[int] = None  # None = never expires
    max_uses: Optional[int] = None           # None = unlimited

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

    @field_validator('new_password')
    @classmethod
    def validate_new_password(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters')
        return v

def generate_invite_token(channel_id: str, invite_id: str, created_at: str) -> str:
    """Generate HMAC-SHA256 signed invite token."""
    message = f"{channel_id}:{invite_id}:{created_at}"
    signature = hmac.new(SECRET_KEY.encode(), message.encode(), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(signature).decode().rstrip('=')

def verify_invite_token(token: str, channel_id: str, invite_id: str, created_at: str) -> bool:
    """Verify HMAC-SHA256 signed invite token."""
    expected = generate_invite_token(channel_id, invite_id, created_at)
    return hmac.compare_digest(expected, token)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
    if user is None:
        raise credentials_exception
    return User(**user)

avatar_urls = [
    "https://images.unsplash.com/photo-1650913406617-bd9b0ab07d07?w=200&h=200&fit=crop",
    "https://images.unsplash.com/photo-1771050889377-b68415885c64?w=200&h=200&fit=crop",
    "https://images.unsplash.com/photo-1648293821367-b39c09679658?w=200&h=200&fit=crop",
    "https://images.pexels.com/photos/4565706/pexels-photo-4565706.jpeg?w=200&h=200&fit=crop",
    "https://images.pexels.com/photos/3228830/pexels-photo-3228830.jpeg?w=200&h=200&fit=crop"
]

@api_router.post("/auth/register", response_model=Token)
@limiter.limit("5/minute")
async def register(request: Request, user_data: UserCreate):
    existing_user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    existing_username = await db.users.find_one({"username": user_data.username}, {"_id": 0})
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    hashed_password = get_password_hash(user_data.password)
    avatar_colors = ["#7c3aed", "#0d9488", "#ec4899", "#f59e0b", "#3b82f6", "#ef4444"]
    import random
    avatar_color = random.choice(avatar_colors)
    avatar_url = random.choice(avatar_urls)
    
    user = User(
        email=user_data.email,
        username=sanitize_input(user_data.username),
        avatar_color=avatar_color,
        avatar_url=avatar_url
    )
    
    user_dict = user.model_dump()
    user_dict["hashed_password"] = hashed_password
    
    await db.users.insert_one(user_dict)
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id}, expires_delta=access_token_expires
    )
    
    general_channel = await db.channels.find_one({"name": "general"}, {"_id": 0})
    if not general_channel:
        general = Channel(
            name="general",
            description="General discussion",
            is_dm=False,
            members=[user.id],
            created_by=user.id
        )
        await db.channels.insert_one(general.model_dump())
    else:
        await db.channels.update_one(
            {"id": general_channel["id"]},
            {"$addToSet": {"members": user.id}}
        )
    
    return Token(access_token=access_token, token_type="bearer", user=user)

@api_router.post("/auth/login", response_model=Token)
@limiter.limit("10/minute")
async def login(request: Request, user_data: UserLogin):
    user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if not user or not verify_password(user_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    user_obj = User(**{k: v for k, v in user.items() if k != "hashed_password"})
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user_obj.id}, expires_delta=access_token_expires
    )
    
    return Token(access_token=access_token, token_type="bearer", user=user_obj)

@api_router.get("/users/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.put("/users/me", response_model=User)
async def update_me(user_update: UserUpdate, current_user: User = Depends(get_current_user)):
    update_data = {k: v for k, v in user_update.model_dump().items() if v is not None}
    if "username" in update_data:
        update_data["username"] = sanitize_input(update_data["username"])
    if "bio" in update_data:
        update_data["bio"] = sanitize_input(update_data["bio"])
    if update_data:
        await db.users.update_one(
            {"id": current_user.id},
            {"$set": update_data}
        )
        if "status" in update_data:
            await manager.broadcast_user_status(current_user.id, current_user.is_online, update_data["status"])
    
    updated_user = await db.users.find_one({"id": current_user.id}, {"_id": 0, "hashed_password": 0})
    return User(**updated_user)

@api_router.get("/users", response_model=List[User])
async def get_users(current_user: User = Depends(get_current_user)):
    users = await db.users.find({}, {"_id": 0, "hashed_password": 0}).to_list(1000)
    return [User(**user) for user in users]

@api_router.post("/channels", response_model=Channel)
async def create_channel(channel_data: ChannelCreate, current_user: User = Depends(get_current_user)):
    members = channel_data.members or []
    if current_user.id not in members:
        members.append(current_user.id)
    
    channel = Channel(
        name=sanitize_input(channel_data.name),
        description=sanitize_input(channel_data.description) if channel_data.description else "",
        is_dm=channel_data.is_dm,
        members=members,
        created_by=current_user.id
    )
    
    await db.channels.insert_one(channel.model_dump())
    return channel

@api_router.get("/channels", response_model=List[Channel])
async def get_channels(current_user: User = Depends(get_current_user)):
    channels = await db.channels.find(
        {"members": current_user.id},
        {"_id": 0}
    ).to_list(1000)
    return [Channel(**channel) for channel in channels]

@api_router.put("/channels/{channel_id}/favorite")
async def toggle_favorite(channel_id: str, current_user: User = Depends(get_current_user)):
    channel = await db.channels.find_one({"id": channel_id}, {"_id": 0})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    is_favorite = channel.get("is_favorite", [])
    if current_user.id in is_favorite:
        await db.channels.update_one(
            {"id": channel_id},
            {"$pull": {"is_favorite": current_user.id}}
        )
        return {"favorite": False}
    else:
        await db.channels.update_one(
            {"id": channel_id},
            {"$addToSet": {"is_favorite": current_user.id}}
        )
        return {"favorite": True}

@api_router.get("/channels/{channel_id}")
async def get_channel(channel_id: str, current_user: User = Depends(get_current_user)):
    channel = await db.channels.find_one({"id": channel_id}, {"_id": 0})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    if current_user.id not in channel.get("members", []):
        raise HTTPException(status_code=403, detail="Access denied")
    return Channel(**channel)

@api_router.put("/channels/{channel_id}")
async def update_channel(channel_id: str, channel_update: ChannelUpdate, current_user: User = Depends(get_current_user)):
    channel = await db.channels.find_one({"id": channel_id}, {"_id": 0})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    if channel.get("created_by") != current_user.id:
        raise HTTPException(status_code=403, detail="Only the channel creator can edit")
    if channel.get("is_dm"):
        raise HTTPException(status_code=400, detail="Cannot edit DM channels")
    
    update_data = {}
    if channel_update.name is not None:
        update_data["name"] = sanitize_input(channel_update.name)
    if channel_update.description is not None:
        update_data["description"] = sanitize_input(channel_update.description)
    
    if update_data:
        await db.channels.update_one({"id": channel_id}, {"$set": update_data})
    
    updated = await db.channels.find_one({"id": channel_id}, {"_id": 0})
    return Channel(**updated)

@api_router.post("/channels/{channel_id}/members")
async def add_member(channel_id: str, member_data: ChannelMemberAction, current_user: User = Depends(get_current_user)):
    channel = await db.channels.find_one({"id": channel_id}, {"_id": 0})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    if current_user.id not in channel.get("members", []):
        raise HTTPException(status_code=403, detail="Access denied")
    if channel.get("is_dm"):
        raise HTTPException(status_code=400, detail="Cannot add members to DM channels")
    
    target_user = await db.users.find_one({"id": member_data.user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if member_data.user_id in channel.get("members", []):
        return {"success": True, "message": "User already a member"}
    
    await db.channels.update_one(
        {"id": channel_id},
        {"$addToSet": {"members": member_data.user_id}}
    )
    
    await manager.broadcast_to_channel({
        "type": "channel_updated",
        "channel_id": channel_id,
        "action": "member_added",
        "user_id": member_data.user_id,
        "username": target_user.get("username", "Unknown")
    }, channel_id)
    
    return {"success": True, "message": f"{target_user.get('username')} added to channel"}

@api_router.delete("/channels/{channel_id}/members/{user_id}")
async def remove_member(channel_id: str, user_id: str, current_user: User = Depends(get_current_user)):
    channel = await db.channels.find_one({"id": channel_id}, {"_id": 0})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    if channel.get("is_dm"):
        raise HTTPException(status_code=400, detail="Cannot remove members from DM channels")
    
    # Only creator or the member themselves can remove
    if current_user.id != channel.get("created_by") and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if user_id not in channel.get("members", []):
        raise HTTPException(status_code=400, detail="User is not a member")
    
    # Creator cannot be removed
    if user_id == channel.get("created_by"):
        raise HTTPException(status_code=400, detail="Cannot remove channel creator")
    
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    
    await db.channels.update_one(
        {"id": channel_id},
        {"$pull": {"members": user_id}}
    )
    
    await manager.broadcast_to_channel({
        "type": "channel_updated",
        "channel_id": channel_id,
        "action": "member_removed",
        "user_id": user_id,
        "username": target_user.get("username", "Unknown") if target_user else "Unknown"
    }, channel_id)
    
    return {"success": True}

@api_router.get("/channels/{channel_id}/members")
async def get_channel_members(channel_id: str, current_user: User = Depends(get_current_user)):
    channel = await db.channels.find_one({"id": channel_id}, {"_id": 0})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    if current_user.id not in channel.get("members", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    member_ids = channel.get("members", [])
    members = await db.users.find(
        {"id": {"$in": member_ids}},
        {"_id": 0, "hashed_password": 0}
    ).to_list(1000)
    
    return {"members": [User(**m).model_dump() for m in members], "created_by": channel.get("created_by")}

@api_router.get("/channels/{channel_id}/messages", response_model=List[Message])
async def get_messages(
    channel_id: str,
    limit: int = Query(default=50, ge=1, le=100),
    before: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user)
):
    channel = await db.channels.find_one({"id": channel_id}, {"_id": 0})
    if not channel or current_user.id not in channel.get("members", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = {"channel_id": channel_id}
    if before:
        query["timestamp"] = {"$lt": before}
    
    messages = await db.messages.find(
        query,
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    messages.reverse()
    return [Message(**msg) for msg in messages]

@api_router.get("/messages/search")
async def search_messages(q: str, current_user: User = Depends(get_current_user)):
    channels = await db.channels.find({"members": current_user.id}, {"_id": 0}).to_list(1000)
    channel_ids = [ch["id"] for ch in channels]
    
    messages = await db.messages.find(
        {
            "channel_id": {"$in": channel_ids},
            "content": {"$regex": re.escape(q), "$options": "i"}
        },
        {"_id": 0}
    ).sort("timestamp", -1).limit(50).to_list(50)
    
    return [Message(**msg) for msg in messages]

@api_router.post("/messages", response_model=Message)
async def create_message(message_data: MessageCreate, current_user: User = Depends(get_current_user)):
    channel = await db.channels.find_one({"id": message_data.channel_id}, {"_id": 0})
    if not channel or current_user.id not in channel.get("members", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    content = sanitize_input(message_data.content)
    if not content:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    message = Message(
        channel_id=message_data.channel_id,
        user_id=current_user.id,
        username=current_user.username,
        content=content,
        avatar_color=current_user.avatar_color,
        avatar_url=current_user.avatar_url,
        reply_to=message_data.reply_to,
        thread_id=message_data.thread_id,
        read_by=[current_user.id]
    )
    
    await db.messages.insert_one(message.model_dump())
    
    # If this is a thread reply, increment parent's reply_count
    if message_data.thread_id:
        await db.messages.update_one(
            {"id": message_data.thread_id},
            {"$inc": {"reply_count": 1}}
        )
        # Broadcast thread update to channel
        parent_msg = await db.messages.find_one({"id": message_data.thread_id}, {"_id": 0})
        if parent_msg:
            await manager.broadcast_to_channel({
                "type": "thread_updated",
                "data": Message(**parent_msg).model_dump()
            }, message_data.channel_id)
    
    await manager.broadcast_to_channel({
        "type": "message",
        "data": message.model_dump()
    }, message_data.channel_id)
    
    # Update unread counts for other members
    for member_id in channel.get("members", []):
        if member_id != current_user.id:
            await db.channels.update_one(
                {"id": message_data.channel_id},
                {"$inc": {f"unread_count.{member_id}": 1}}
            )
    
    return message

@api_router.put("/channels/{channel_id}/read")
async def mark_channel_read(channel_id: str, current_user: User = Depends(get_current_user)):
    await db.channels.update_one(
        {"id": channel_id},
        {"$set": {f"unread_count.{current_user.id}": 0}}
    )
    return {"success": True}

@api_router.put("/messages/{message_id}", response_model=Message)
async def update_message(message_id: str, message_update: MessageUpdate, current_user: User = Depends(get_current_user)):
    message = await db.messages.find_one({"id": message_id}, {"_id": 0})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    if message["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    content = sanitize_input(message_update.content)
    if not content:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    await db.messages.update_one(
        {"id": message_id},
        {"$set": {
            "content": content,
            "edited": True,
            "edited_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    updated_message = await db.messages.find_one({"id": message_id}, {"_id": 0})
    message_obj = Message(**updated_message)
    
    await manager.broadcast_to_channel({
        "type": "message_updated",
        "data": message_obj.model_dump()
    }, message["channel_id"])
    
    return message_obj

@api_router.delete("/messages/{message_id}")
async def delete_message(message_id: str, current_user: User = Depends(get_current_user)):
    message = await db.messages.find_one({"id": message_id}, {"_id": 0})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    if message["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.messages.delete_one({"id": message_id})
    
    await manager.broadcast_to_channel({
        "type": "message_deleted",
        "message_id": message_id
    }, message["channel_id"])
    
    return {"success": True}

@api_router.post("/messages/{message_id}/reactions")
async def add_reaction(message_id: str, reaction_data: MessageReaction, current_user: User = Depends(get_current_user)):
    message = await db.messages.find_one({"id": message_id}, {"_id": 0})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    reaction = Reaction(
        emoji=reaction_data.emoji,
        user_id=current_user.id,
        username=current_user.username
    )
    
    reactions = message.get("reactions", [])
    existing_reaction = next((r for r in reactions if r["user_id"] == current_user.id and r["emoji"] == reaction.emoji), None)
    
    if existing_reaction:
        await db.messages.update_one(
            {"id": message_id},
            {"$pull": {"reactions": {"user_id": current_user.id, "emoji": reaction.emoji}}}
        )
    else:
        await db.messages.update_one(
            {"id": message_id},
            {"$push": {"reactions": reaction.model_dump()}}
        )
    
    updated_message = await db.messages.find_one({"id": message_id}, {"_id": 0})
    message_obj = Message(**updated_message)
    
    await manager.broadcast_to_channel({
        "type": "reaction_updated",
        "data": message_obj.model_dump()
    }, message["channel_id"])
    
    return message_obj

@api_router.post("/messages/{message_id}/pin")
async def toggle_pin(message_id: str, current_user: User = Depends(get_current_user)):
    message = await db.messages.find_one({"id": message_id}, {"_id": 0})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    new_pinned_status = not message.get("pinned", False)
    await db.messages.update_one(
        {"id": message_id},
        {"$set": {"pinned": new_pinned_status}}
    )
    
    updated_message = await db.messages.find_one({"id": message_id}, {"_id": 0})
    message_obj = Message(**updated_message)
    
    await manager.broadcast_to_channel({
        "type": "message_updated",
        "data": message_obj.model_dump()
    }, message["channel_id"])
    
    return {"pinned": new_pinned_status}

@api_router.post("/messages/{message_id}/read")
async def mark_message_read(message_id: str, current_user: User = Depends(get_current_user)):
    message = await db.messages.find_one({"id": message_id}, {"_id": 0})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    read_by = message.get("read_by", [])
    if current_user.id not in read_by:
        await db.messages.update_one(
            {"id": message_id},
            {"$addToSet": {"read_by": current_user.id}}
        )
        # Broadcast read receipt
        await manager.broadcast_to_channel({
            "type": "message_read",
            "message_id": message_id,
            "user_id": current_user.id,
            "username": current_user.username
        }, message["channel_id"])
    
    return {"success": True}

@api_router.post("/channels/{channel_id}/read-all")
async def mark_all_read(channel_id: str, current_user: User = Depends(get_current_user)):
    channel = await db.channels.find_one({"id": channel_id}, {"_id": 0})
    if not channel or current_user.id not in channel.get("members", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Mark all messages as read by current user
    await db.messages.update_many(
        {
            "channel_id": channel_id,
            "read_by": {"$ne": current_user.id}
        },
        {"$addToSet": {"read_by": current_user.id}}
    )
    
    # Also reset unread count
    await db.channels.update_one(
        {"id": channel_id},
        {"$set": {f"unread_count.{current_user.id}": 0}}
    )
    
    return {"success": True}

@api_router.get("/messages/{message_id}/thread", response_model=List[Message])
async def get_thread(message_id: str, current_user: User = Depends(get_current_user)):
    parent = await db.messages.find_one({"id": message_id}, {"_id": 0})
    if not parent:
        raise HTTPException(status_code=404, detail="Message not found")
    
    channel = await db.channels.find_one({"id": parent["channel_id"]}, {"_id": 0})
    if not channel or current_user.id not in channel.get("members", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    replies = await db.messages.find(
        {"thread_id": message_id},
        {"_id": 0}
    ).sort("timestamp", 1).to_list(500)
    
    return [Message(**msg) for msg in replies]

@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Max size is 10MB.")
    
    file_id = str(uuid.uuid4())
    file_ext = Path(file.filename).suffix
    file_path = UPLOADS_DIR / f"{file_id}{file_ext}"
    
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(content)
    
    return {
        "file_url": f"/uploads/{file_id}{file_ext}",
        "file_name": file.filename,
        "file_type": file.content_type
    }

@api_router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    # Verify user exists
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        await websocket.close(code=4001)
        return
    
    await manager.connect(websocket, user_id)
    await manager.broadcast_user_status(user_id, True)
    
    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=60)
            except asyncio.TimeoutError:
                # Send heartbeat ping
                try:
                    await websocket.send_json({"type": "ping"})
                except Exception:
                    break
                continue
            
            message_data = json.loads(data)
            
            if message_data.get("type") == "pong":
                continue
            elif message_data.get("type") == "typing":
                await manager.broadcast_to_channel({
                    "type": "typing",
                    "user_id": user_id,
                    "username": message_data.get("username"),
                    "channel_id": message_data.get("channel_id"),
                    "is_typing": message_data.get("is_typing")
                }, message_data.get("channel_id"))
            
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logging.error(f"WebSocket error for user {user_id}: {e}")
    finally:
        manager.disconnect(user_id)
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"is_online": False, "last_seen": datetime.now(timezone.utc).isoformat()}}
        )
        await manager.broadcast_user_status(user_id, False)

# ── Change Password ──────────────────────────────────────────────────────────

@api_router.put("/auth/change-password")
async def change_password(data: PasswordChange, current_user: User = Depends(get_current_user)):
    user_doc = await db.users.find_one({"id": current_user.id}, {"_id": 0})
    if not user_doc or not verify_password(data.current_password, user_doc.get("hashed_password", "")):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    new_hash = get_password_hash(data.new_password)
    await db.users.update_one({"id": current_user.id}, {"$set": {"hashed_password": new_hash}})
    return {"success": True, "message": "Password changed successfully"}

# ── Delete Account ────────────────────────────────────────────────────────────

@api_router.delete("/users/me")
async def delete_account(current_user: User = Depends(get_current_user)):
    # Remove from all channels
    await db.channels.update_many(
        {"members": current_user.id},
        {"$pull": {"members": current_user.id}}
    )
    # Delete all messages (optional – could keep as tombstones)
    await db.messages.delete_many({"user_id": current_user.id})
    # Deactivate invite links
    await db.invite_links.update_many({"created_by": current_user.id}, {"$set": {"is_active": False}})
    # Delete user
    await db.users.delete_one({"id": current_user.id})
    return {"success": True, "message": "Account deleted"}

# ── Invite Links ──────────────────────────────────────────────────────────────

@api_router.post("/channels/{channel_id}/invites")
async def create_invite(channel_id: str, invite_data: InviteCreate, current_user: User = Depends(get_current_user)):
    channel = await db.channels.find_one({"id": channel_id}, {"_id": 0})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    if current_user.id not in channel.get("members", []):
        raise HTTPException(status_code=403, detail="Access denied")
    if channel.get("is_dm"):
        raise HTTPException(status_code=400, detail="Cannot create invite for DM channels")

    invite = InviteLink(
        channel_id=channel_id,
        created_by=current_user.id,
        max_uses=invite_data.max_uses,
    )
    if invite_data.expires_in_hours:
        expire_dt = datetime.now(timezone.utc) + timedelta(hours=invite_data.expires_in_hours)
        invite.expires_at = expire_dt.isoformat()

    # Generate HMAC token after we have the id and created_at
    invite.token = generate_invite_token(channel_id, invite.id, invite.created_at)

    await db.invite_links.insert_one(invite.model_dump())
    return invite.model_dump()

@api_router.get("/channels/{channel_id}/invites")
async def list_invites(channel_id: str, current_user: User = Depends(get_current_user)):
    channel = await db.channels.find_one({"id": channel_id}, {"_id": 0})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    if current_user.id not in channel.get("members", []):
        raise HTTPException(status_code=403, detail="Access denied")
    invites = await db.invite_links.find(
        {"channel_id": channel_id, "is_active": True}, {"_id": 0}
    ).to_list(100)
    return invites

@api_router.delete("/invites/{invite_id}")
async def revoke_invite(invite_id: str, current_user: User = Depends(get_current_user)):
    invite = await db.invite_links.find_one({"id": invite_id}, {"_id": 0})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    channel = await db.channels.find_one({"id": invite["channel_id"]}, {"_id": 0})
    # Only channel members (or invite creator) can revoke
    if not channel or current_user.id not in channel.get("members", []):
        raise HTTPException(status_code=403, detail="Access denied")
    await db.invite_links.update_one({"id": invite_id}, {"$set": {"is_active": False}})
    return {"success": True}

@api_router.get("/invites/{token}/info")
async def get_invite_info(token: str):
    """Public endpoint – returns channel preview without auth."""
    invite = await db.invite_links.find_one({"token": token, "is_active": True}, {"_id": 0})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite link not found or has been revoked")

    # Verify HMAC signature
    if not verify_invite_token(token, invite["channel_id"], invite["id"], invite["created_at"]):
        raise HTTPException(status_code=400, detail="Invalid invite token")

    # Check expiry
    if invite.get("expires_at"):
        expires = datetime.fromisoformat(invite["expires_at"])
        if datetime.now(timezone.utc) > expires:
            raise HTTPException(status_code=400, detail="This invite link has expired")

    # Check max uses
    if invite.get("max_uses") and invite["use_count"] >= invite["max_uses"]:
        raise HTTPException(status_code=400, detail="This invite link has reached its maximum uses")

    channel = await db.channels.find_one({"id": invite["channel_id"]}, {"_id": 0})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel no longer exists")

    creator = await db.users.find_one({"id": invite["created_by"]}, {"_id": 0, "hashed_password": 0})
    member_count = len(channel.get("members", []))

    return {
        "channel_id": channel["id"],
        "channel_name": channel["name"],
        "channel_description": channel.get("description", ""),
        "member_count": member_count,
        "created_by_username": creator["username"] if creator else "Unknown",
        "expires_at": invite.get("expires_at"),
        "use_count": invite["use_count"],
        "max_uses": invite.get("max_uses"),
    }

@api_router.post("/invites/{token}/join")
async def join_via_invite(token: str, current_user: User = Depends(get_current_user)):
    invite = await db.invite_links.find_one({"token": token, "is_active": True}, {"_id": 0})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite link not found or has been revoked")

    # Verify HMAC
    if not verify_invite_token(token, invite["channel_id"], invite["id"], invite["created_at"]):
        raise HTTPException(status_code=400, detail="Invalid invite token")

    # Check expiry
    if invite.get("expires_at"):
        expires = datetime.fromisoformat(invite["expires_at"])
        if datetime.now(timezone.utc) > expires:
            raise HTTPException(status_code=400, detail="This invite link has expired")

    # Check max uses
    if invite.get("max_uses") and invite["use_count"] >= invite["max_uses"]:
        raise HTTPException(status_code=400, detail="This invite link has reached its maximum uses")

    channel = await db.channels.find_one({"id": invite["channel_id"]}, {"_id": 0})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel no longer exists")

    # Idempotent – if already a member just return success
    if current_user.id in channel.get("members", []):
        return {"success": True, "channel_id": channel["id"], "channel_name": channel["name"], "already_member": True}

    # Add user to channel
    await db.channels.update_one(
        {"id": invite["channel_id"]},
        {"$addToSet": {"members": current_user.id}}
    )
    # Increment use count
    await db.invite_links.update_one({"id": invite["id"]}, {"$inc": {"use_count": 1}})

    # Broadcast to channel
    await manager.broadcast_to_channel({
        "type": "channel_updated",
        "channel_id": invite["channel_id"],
        "action": "member_added",
        "user_id": current_user.id,
        "username": current_user.username
    }, invite["channel_id"])

    return {"success": True, "channel_id": channel["id"], "channel_name": channel["name"], "already_member": False}

# Health check endpoint
@api_router.get("/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}

app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Temporarily broad for local testing verification
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_db_setup():
    # Create indexes for performance
    await db.users.create_index("id", unique=True)
    await db.users.create_index("email", unique=True)
    await db.channels.create_index("id", unique=True)
    await db.messages.create_index("id", unique=True)
    await db.messages.create_index([("channel_id", 1), ("timestamp", -1)])
    await db.messages.create_index([("content", "text")])
    await db.invite_links.create_index("id", unique=True)
    await db.invite_links.create_index("token")
    await db.invite_links.create_index("channel_id")
    logger.info("Database indexes created successfully")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
