import time
import asyncio
import json
import os
import sqlite3
import subprocess
from datetime import datetime, timezone, timedelta

import httpx
import psutil
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

from sse import SSEManager, sse_manager

app = FastAPI(title="Rhodes Command Center API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3489"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
