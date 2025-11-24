from pathlib import Path
path = Path(r"catalogos/app.py")
text = path.read_text()
start = text.index("@app.route(\"/api/ia/chat_apu\"")
end = text.index("@app.route(\"/api/ia/explicar_sugerencia\"", start)
print(start, end)
