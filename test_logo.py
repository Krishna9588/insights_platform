import asyncio
import httpx

async def test_logo():
    async with httpx.AsyncClient() as client:
        # Note: adjust the port if your backend runs on a different port
        res = await client.get("http://127.0.0.1:8000/logo?domain=apple.com")
        print(res.status_code)
        print(res.json())

if __name__ == "__main__":
    asyncio.run(test_logo())
