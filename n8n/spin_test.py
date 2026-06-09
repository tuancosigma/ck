import asyncio
from playwright.async_api import async_playwright
import os

async def main():
    url = "https://spinthewheel.app/n-g-by-gi"
    print(f"Opening browser to {url}...")
    
    async with async_playwright() as p:
        # Launch browser in headful or headless mode
        browser = await p.chromium.launch(headless=True)
        # Create a browser context with a standard desktop viewport
        context = await browser.new_context(
            viewport={"width": 1280, "height": 720},
            device_scale_factor=1
        )
        page = await context.new_page()
        
        # Go to spinthewheel URL
        await page.goto(url, wait_until="networkidle", timeout=60000)
        print("Page loaded successfully. Waiting 3 seconds...")
        await asyncio.sleep(3)
        
        # Try to find the spin button or elements
        print("Searching for spin button...")
        
        # Method 1: Click the element containing the text "Spin"
        spin_btn = page.locator('text="Spin"').first
        clicked = False
        
        if await spin_btn.count() > 0:
            print("Found 'Spin' text element! Clicking it...")
            await spin_btn.click(force=True)
            clicked = True
        else:
            # Method 2: Click the center of the first canvas element
            canvas = page.locator('canvas').first
            if await canvas.count() > 0:
                print("Spin text not found, clicking the center of the Canvas...")
                box = await canvas.bounding_box()
                if box:
                    center_x = box['x'] + box['width'] / 2
                    center_y = box['y'] + box['height'] / 2
                    await page.mouse.click(center_x, center_y)
                    clicked = True
                    print(f"Clicked canvas at center ({center_x}, {center_y})")
        
        if not clicked:
            print("Warning: Could not find any click target! Clicking center of the viewport...")
            await page.mouse.click(640, 360)
            
        print("Spin triggered! Waiting 10 seconds for the wheel to spin and show result...")
        await asyncio.sleep(10)
        
        # Take a screenshot
        screenshot_path = os.path.abspath("lunch_result.png")
        await page.screenshot(path=screenshot_path, full_page=False)
        print(f"Screenshot successfully saved to: {screenshot_path}")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
