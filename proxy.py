from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json
import os

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

API_KEY = ""
with open("anthropic.key", "r") as file:
    API_KEY = file.read()

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/api/chat', methods=['POST'])
def chat():
    body = request.json
    
    # Add cache control to system prompt
    if 'system' in body:
        # Extract name if prepended, we'll handle it differently
        system_text = body['system']
        if system_text.startswith('Your name is'):
            # Strip the name prefix before caching
            system_text = system_text.split('.', 1)[1].strip()

        body['system'] = [
            {
                "type": "text",
                "text": body['system'],
                "cache_control": {"type": "ephemeral"}
            }
        ]
    
    print("SYSTEM TYPE:", type(body.get('system')))
    print("SYSTEM CONTENT:", json.dumps(body.get('system'), indent=2))
    print("TOTAL INPUT TOKENS APPROX:", len(str(body)) // 4)
    
    response = requests.post(
        'https://api.anthropic.com/v1/messages',
        headers={
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
            'anthropic-version': '2023-06-01',
            'anthropic-beta': 'prompt-caching-2024-07-31'
        },
        json=body
    )
    usage = response.json().get('usage', {})
    print(f"cache_write: {usage.get('cache_creation_input_tokens', 0)} cache_read: {usage.get('cache_read_input_tokens', 0)}")
    return jsonify(response.json())

app.run(port=3000)