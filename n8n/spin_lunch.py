import asyncio
import os
import sys
import json
import requests
from playwright.async_api import async_playwright

# Configuration File Path
CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "spin_config.json")

def get_webhook_url():
    # 1. Check command line argument
    if len(sys.argv) > 1 and sys.argv[1].startswith("https://"):
        return sys.argv[1]
        
    # 2. Check spin_config.json
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                config = json.load(f)
                url = config.get("teams_webhook_url")
                if url:
                    return url
        except Exception as e:
            print(f"Error reading config file: {e}")
            
    # 3. Check environment variable
    env_url = os.environ.get("TEAMS_WEBHOOK_URL")
    if env_url:
        return env_url
        
    return None

async def main():
    webhook_url = get_webhook_url()
    if not webhook_url:
        print("[ERROR] Microsoft Teams Webhook URL is missing!")
        print("Please provide it as an argument, set TEAMS_WEBHOOK_URL env var, or configure it in spin_config.json")
        print("\nUsage:")
        print("  python spin_lunch.py <YOUR_TEAMS_WEBHOOK_URL>")
        sys.exit(1)

    url = "https://spinthewheel.app/n-g-by-gi"
    screenshot_name = "lunch_result.png"
    screenshot_path = os.path.abspath(screenshot_name)
    
    print(f"1. Opening browser to {url}...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 720},
            device_scale_factor=1
        )
        page = await context.new_page()
        
        try:
            await page.goto(url, wait_until="networkidle", timeout=60000)
            print("2. Page loaded successfully. Waiting 3 seconds...")
            await asyncio.sleep(3)
            
            print("3. Locating spin button...")
            spin_btn = page.locator('text="Spin"').first
            clicked = False
            
            if await spin_btn.count() > 0:
                print("Found 'Spin' text element. Spinning the wheel...")
                await spin_btn.click(force=True)
                clicked = True
            else:
                canvas = page.locator('canvas').first
                if await canvas.count() > 0:
                    print("Spin button not found. Attempting click on canvas center...")
                    box = await canvas.bounding_box()
                    if box:
                        await page.mouse.click(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
                        clicked = True
            
            if not clicked:
                print("[WARNING] Could not locate spin button. Clicking viewport center...")
                await page.mouse.click(640, 360)
                
            print("4. Spinning... Waiting 10 seconds for result...")
            await asyncio.sleep(10)
            
            # Capture screenshot
            await page.screenshot(path=screenshot_path)
            print(f"5. Screenshot saved to {screenshot_path}")
            
        except Exception as e:
            print(f"[ERROR] Browser automation failed: {e}")
            await browser.close()
            sys.exit(1)
        finally:
            await browser.close()
            
    # Uploading to tmpfiles.org
    print("6. Uploading screenshot to tmpfiles.org (anonymous hosting)...")
    try:
        with open(screenshot_path, "rb") as f:
            r = requests.post("https://tmpfiles.org/api/v1/upload", files={"file": f}, timeout=30)
            
        if r.status_code == 200:
            res_data = r.json()
            if res_data.get("status") == "success":
                raw_url = res_data["data"]["url"]
                # Convert standard link to direct download link for image embedding
                direct_img_url = raw_url.replace("https://tmpfiles.org/", "https://tmpfiles.org/dl/")
                print(f"Uploaded successfully! Direct URL: {direct_img_url}")
                
                # Send to Microsoft Teams via Webhook
                print("7. Sending notification to Microsoft Teams...")
                # Send a beautiful Adaptive Card to Microsoft Teams
                teams_payload = {
                    "type": "AdaptiveCard",
                    "version": "1.4",
                    "body": [
                        {
                            "type": "Image",
                            "url": "https://media.giphy.com/media/l3q2zVr6cu95nF6O4/giphy.gif",
                            "size": "Medium",
                            "horizontalAlignment": "Center"
                        },
                        {
                            "type": "TextBlock",
                            "text": "✉️ BẢN TIN SPIN BỮA TRƯA HẰNG NGÀY ✉️",
                            "weight": "Bolder",
                            "size": "Medium",
                            "color": "Accent",
                            "horizontalAlignment": "Center"
                        },
                        {
                            "type": "TextBlock",
                            "text": "Hôm nay chúng ta sẽ ăn món gì đây? Vòng quay may mắn đã chọn:",
                            "wrap": True
                        },
                        {
                            "type": "Image",
                            "url": direct_img_url,
                            "size": "Large"
                        }
                    ],
                    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json"
                }
                
                tr = requests.post(webhook_url, json=teams_payload, timeout=20)
                if tr.status_code in [200, 201, 202]:
                    print("[SUCCESS] Notification successfully sent to MS Teams!")
                else:
                    print(f"[ERROR] Failed to send to MS Teams. Status code: {tr.status_code}, Response: {tr.text}")
            else:
                print(f"[ERROR] Tmpfiles.org upload rejected: {res_data}")
        else:
            print(f"[ERROR] Tmpfiles.org upload failed with status code {r.status_code}: {r.text}")
    except Exception as e:
        print(f"[ERROR] Upload/Notification process failed: {e}")
    finally:
        # Clean up screenshot
        if os.path.exists(screenshot_path):
            try:
                os.remove(screenshot_path)
                print("8. Cleaned up local screenshot.")
            except Exception as ce:
                print(f"Error cleaning up file: {ce}")

if __name__ == "__main__":
    asyncio.run(main())
