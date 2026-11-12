# functions are reusable pieces of code that perform a specific task. They help to organize code, make it more readable, and avoid repetition.

def greet(first_name,last_name):
    """This function greets a person with their name."""
    print(f"Hello, {first_name} {last_name}!")        


greet(input("Enter your name: "), input("Enter your last name: "))
