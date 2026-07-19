import os
import json
from pathlib import Path
from dotenv import load_dotenv
from typing import Optional, Dict, Any

from agents.paths import CONFIG_FILE

# Load environment variables
load_dotenv()

def get_api_key_list(provider: str) -> list[str]:
    keys = []
    # 1. Try to load from config.json
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                config = json.load(f)
                api_keys = config.get("api_keys", [])
                # Add default key first
                for key_entry in api_keys:
                    if key_entry.get("provider") == provider and key_entry.get("isDefault"):
                        keys.append(key_entry.get("key"))
                # Add fallback keys
                for key_entry in api_keys:
                    if key_entry.get("provider") == provider and not key_entry.get("isDefault"):
                        if key_entry.get("key") not in keys:
                            keys.append(key_entry.get("key"))
        except Exception:
            pass
    
    # 2. Fallback to .env
    if provider in ("gemini", "gemini_2"):
        for env_var in ["GEMINI_API_KEY", "GEMINI_API_KEY_0", "GEMINI_API_KEY_1", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3"]:
            val = os.getenv(env_var)
            if val and val not in keys:
                keys.append(val)
    elif provider == "openai":
        val = os.getenv("OPENAI_API_KEY")
        if val and val not in keys:
            keys.append(val)
    elif provider == "claude":
        val = os.getenv("ANTHROPIC_API_KEY")
        if val and val not in keys:
            keys.append(val)
            
    return keys

def get_api_key(provider: str) -> Optional[str]:
    keys = get_api_key_list(provider)
    return keys[0] if keys else None

# ==========================================
# 1. INDIVIDUAL MODEL FUNCTIONS
# ==========================================

def call_openai(prompt: str, system_prompt: str = "", model: str = "gpt-4o") -> str:
    from openai import OpenAI
    
    api_key = get_api_key("openai")
    if not api_key:
        raise ValueError("OpenAI API key not found in config or .env")
        
    client = OpenAI(api_key=api_key)

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    response = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.2
    )
    return response.choices[0].message.content


def call_claude(prompt: str, system_prompt: str = "", model: str = "claude-3-5-sonnet-20240620") -> str:
    import anthropic
    
    api_key = get_api_key("claude")
    if not api_key:
        raise ValueError("Anthropic API key not found in config or .env")
        
    client = anthropic.Anthropic(api_key=api_key)

    response = client.messages.create(
        model=model,
        max_tokens=4096,
        temperature=0.2,
        system=system_prompt,
        messages=[
            {"role": "user", "content": prompt}
        ]
    )
    return response.content[0].text


def call_gemini(prompt: str, system_prompt: str = "", model: str = "gemini-2.5-flash") -> str:
    from google import genai
    from google.genai import types
    from google.genai.errors import APIError

    api_keys = get_api_key_list("gemini")
    if not api_keys:
        raise ValueError("Gemini API key not found in config or .env")

    last_error = None
    for api_key in api_keys:
        try:
            client = genai.Client(api_key=api_key)
            config = types.GenerateContentConfig(
                system_instruction=system_prompt,
            )
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=config
            )
            return response.text
        except APIError as e:
            print(f"Gemini API Error: {e} - trying next key...")
            last_error = e
            continue
        except Exception as e:
            print(f"Unexpected error: {e} - trying next key...")
            last_error = e
            continue

    raise ValueError(f"All Gemini API keys failed. Last error: {last_error}")

def call_gemini_2(prompt: str, system_prompt: str = "", model: str = "gemini-3-flash-preview") -> str:
    import google.genai as genai
    from google.genai.errors import APIError
    
    api_keys = get_api_key_list("gemini_2") or get_api_key_list("gemini")
    if not api_keys:
        raise ValueError("Gemini API key not found in config or .env")
        
    prompt = system_prompt + "\n\n" + prompt
    last_error = None
    
    for api_key in api_keys:
        try:
            genai.configure(api_key=api_key)
            model_obj = genai.GenerativeModel(model)
            response = model_obj.generate_content(prompt)
            return response.text
        except APIError as e:
            print(f"Gemini API Error: {e} - trying next key...")
            last_error = e
            continue
        except Exception as e:
            print(f"Unexpected error: {e} - trying next key...")
            last_error = e
            continue
            
    raise ValueError(f"All Gemini API keys failed. Last error: {last_error}")

# ==========================================
# 2. MAIN UNIFIED FUNCTION
# ==========================================

def call_llm(
        prompt: str,
        system_prompt: str = "",
        provider: str = "gemini",
        model: Optional[str] = None,
        json_mode: bool = False
) -> str:
    """
    Unified function to call any LLM.
    :param provider: "openai", "claude", or "gemini"
    :param json_mode: If True, appends instructions to ensure JSON output.
    """
    if json_mode:
        system_prompt += "\n\nCRITICAL: You must respond ONLY with valid JSON. Do not include markdown formatting like ```json."

    try:
        if provider.lower() == "openai":
            target_model = model or "gpt-4o"
            return call_openai(prompt, system_prompt, target_model)

        elif provider.lower() == "claude":
            target_model = model or "claude-sonnet-4-6"
            return call_claude(prompt, system_prompt, target_model)

        elif provider.lower() == "gemini":
            target_model = model or "gemini-2.5-flash"
            return call_gemini(prompt, system_prompt, target_model)

        elif provider.lower() == "gemini_2":
            target_model = model or "gemini-2.5-flash-lite"
            return call_gemini_2(prompt, system_prompt, target_model)

        else:
            raise ValueError(f"Unsupported provider: {provider}")

    except Exception as e:
        print(f"Error calling {provider}: {str(e)}")
        return json.dumps({"error": str(e)}) if json_mode else f"Error: {str(e)}"

# Example Usage:
# response = call_llm(prompt="Extract insights from this text...", provider="gemini", json_mode=True)