# keyword arguaments = arguments that are passed to a function by explicitly stating which parameter they should be assigned to

def hello(first, middle, last):
    print(f"Hello {first} {middle} {last}!")

hello(last="Smith", first="John", middle="K.")
hello("Jane", last="Doe", middle="A.")
