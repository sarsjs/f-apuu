from flask import Blueprint, request, jsonify, session
from backend.config import Config
auth_bp = Blueprint('auth_bp', __name__)
@auth_bp.route("/login", methods=["POST"])
def login():
    payload = request.get_json(silent=True) or {}
    username = (payload.get("username") or "").strip()
    if username == Config.ADMIN_USERNAME and payload.get("password") == Config.ADMIN_PASSWORD:
        session["user"] = {"id": 1, "username": username, "is_admin": True}
        return jsonify({"message": "Login successful", "user": session["user"]})
    return jsonify({"error": "Invalid credentials"}), 401
@auth_bp.route("/me", methods=["GET"])
def auth_me(): return jsonify(session.get("user")) if "user" in session else (jsonify({"error": "Not authenticated"}), 401)
@auth_bp.route("/logout", methods=["POST"])
def logout(): session.pop("user", None); return jsonify({"message": "Logged out"})
