from fastapi import APIRouter, HTTPException
import httpx
import os
from pathlib import Path

router = APIRouter()

FRONTEND_PUBLIC_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "public" / "logos"

@router.get("/logo")
async def get_logo(domain: str):
    """
    Fetches the logo for a given domain and saves it to the frontend/public/logos folder.
    Returns the relative URL to the logo.
    """
    # Create the logos directory if it doesn't exist
    FRONTEND_PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    
    # Safe filename for the domain
    safe_domain = "".join(c for c in domain if c.isalnum() or c in ".-_").lower()
    if not safe_domain:
        raise HTTPException(status_code=400, detail="Invalid domain")
        
    logo_path = FRONTEND_PUBLIC_DIR / f"{safe_domain}.png"
    
    # If we already downloaded it, just return the path
    if logo_path.exists():
        return {"url": f"/logos/{safe_domain}.png"}
        
    # Attempt to fetch from logo.dev using the provided token
    # If the user provides a token in config later, this can be updated dynamically.
    token = "pk_Tw38O-4_RNinmXOwNIgagQ"
    url = f"https://img.logo.dev/{safe_domain}?token={token}"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=10.0)
            
            if response.status_code == 200 and response.content:
                # Save the image
                with open(logo_path, "wb") as f:
                    f.write(response.content)
                return {"url": f"/logos/{safe_domain}.png"}
            else:
                # Fallback transparent or placeholder URL if we can't get it
                raise HTTPException(status_code=404, detail="Logo not found")
                
    except Exception as e:
        print(f"Error fetching logo for {domain}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch logo")
