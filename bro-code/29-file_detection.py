import os

path = "./29-file_detection.py"

if os.path.exists(path):
    print(f"The file at {path} exists.")
else:
    print(f"The file at {path} does not exist.")