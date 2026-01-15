import pandas as pd
import os

# Shopee-like format
shopee_data = {
    "Item Name": ["iPhone 13 Case", "Samsung Charger", "Bluetooth Headset"],
    "Price": [150000, 250000, 500000],
    "Item Link": ["https://shopee.vn/p1", "https://shopee.vn/p2", "https://shopee.vn/p3"],
    "Product Description": ["Good case", "Fast charge", "Good sound"],
    "Image": ["img1.jpg", "img2.jpg", "img3.jpg"]
}
df_shopee = pd.DataFrame(shopee_data)
df_shopee.to_excel("sample_shopee.xlsx", index=False)
print("Created sample_shopee.xlsx")

# Tiki-like format
tiki_data = {
    "product_title": ["MacBook Air M1", "Logitech Mouse"],
    "original_price": [18000000, 500000],
    "product_url": ["https://tiki.vn/p1", "https://tiki.vn/p2"],
    "desc": ["Laptop Apple", "Wireless mouse"],
    "img_link": ["mac.jpg", "mouse.jpg"]
}
df_tiki = pd.DataFrame(tiki_data)
df_tiki.to_csv("sample_tiki.csv", index=False)
print("Created sample_tiki.csv")

# Unknown format (for testing robustness)
unknown_data = {
    "Name": ["Unknown Item"],
    "Cost": [100]
}
df_unknown = pd.DataFrame(unknown_data)
df_unknown.to_csv("sample_unknown.csv", index=False)
print("Created sample_unknown.csv")
