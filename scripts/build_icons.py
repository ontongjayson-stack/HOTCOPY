import os
from PIL import Image

def generate_icons():
    workspace_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    logo_path = os.path.join(workspace_dir, "Logo.jfif")
    icons_dir = os.path.join(workspace_dir, "icons")
    
    os.makedirs(icons_dir, exist_ok=True)
    
    if not os.path.exists(logo_path):
        print(f"Error: Logo file not found at {logo_path}")
        return False
        
    print(f"Loading logo from {logo_path}...")
    img = Image.open(logo_path)
    
    # Square crop the center of the image if not square
    width, height = img.size
    min_dim = min(width, height)
    left = (width - min_dim) // 2
    top = (height - min_dim) // 2
    right = left + min_dim
    bottom = top + min_dim
    
    img_cropped = img.crop((left, top, right, bottom))
    
    sizes = [16, 32, 48, 128]
    for size in sizes:
        resized = img_cropped.resize((size, size), Image.Resampling.LANCZOS)
        out_path = os.path.join(icons_dir, f"icon-{size}.png")
        resized.save(out_path, "PNG")
        print(f"Created {out_path} ({size}x{size})")
        
    print("All icons successfully generated!")
    return True

if __name__ == "__main__":
    generate_icons()
