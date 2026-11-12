try:
    with open ("./README.mde", 'r') as file:
        content = file.read()
        print(content)
except FileNotFoundError:
    print("The file was not found.")