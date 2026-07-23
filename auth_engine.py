"""Auth: users table + JWT."""
import os, sqlite3, time
from contextlib import contextmanager
import bcrypt
from jose import JWTError, jwt

_BASE    = os.path.dirname(os.path.abspath(__file__))
DB_PATH  = os.path.join(_BASE, "data", "preflop.db")
SECRET   = "preflop_jwt_secret_change_me_in_prod"
ALGO     = "HS256"
TTL_SECS = 30 * 24 * 3600  # 30 days

def _hash_pw(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def _verify_pw(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except Exception:
        return False

@contextmanager
def _conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    try:
        yield c; c.commit()
    except Exception:
        c.rollback(); raise
    finally:
        c.close()

def init_schema():
    with _conn() as c:
        c.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
        """)
        for tbl in ["attempts", "imported_hands", "tournaments", "notes", "grind_blocks"]:
            try:
                c.execute(f"ALTER TABLE {tbl} ADD COLUMN user_id INTEGER")
            except Exception:
                pass
        for tbl in ["attempts", "imported_hands", "tournaments", "notes", "grind_blocks"]:
            c.execute(f"UPDATE {tbl} SET user_id = 1 WHERE user_id IS NULL")

def create_user(username: str, password: str) -> dict:
    hashed = _hash_pw(password)
    with _conn() as c:
        try:
            c.execute("INSERT INTO users (username, password, created_at) VALUES (?,?,?)",
                      (username, hashed, int(time.time())))
            uid = c.execute("SELECT last_insert_rowid()").fetchone()[0]
            return {"id": uid, "username": username}
        except sqlite3.IntegrityError:
            return {"error": "username_taken"}

def authenticate(username: str, password: str):
    with _conn() as c:
        row = c.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
    if not row or not _verify_pw(password, row["password"]):
        return None
    return {"id": row["id"], "username": row["username"]}

def make_token(user_id: int, username: str) -> str:
    payload = {"sub": str(user_id), "username": username, "exp": int(time.time()) + TTL_SECS}
    return jwt.encode(payload, SECRET, algorithm=ALGO)

def decode_token(token: str):
    try:
        payload = jwt.decode(token, SECRET, algorithms=[ALGO])
        return {"id": int(payload["sub"]), "username": payload["username"]}
    except JWTError:
        return None

def get_user(user_id: int):
    with _conn() as c:
        row = c.execute("SELECT id, username FROM users WHERE id=?", (user_id,)).fetchone()
    return dict(row) if row else None

def list_users():
    with _conn() as c:
        rows = c.execute("SELECT id, username, created_at FROM users").fetchall()
    return [dict(r) for r in rows]

init_schema()
