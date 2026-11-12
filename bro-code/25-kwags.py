# **kwargs = keyword arguments

def calculate(n, **kwargs):
    print(kwargs)
    n += kwargs.get("add", 0)
    n *= kwargs.get("multiply", 1)
    return n
print(calculate(2, add=3, multiply=5))
print(calculate(3, add=5))
