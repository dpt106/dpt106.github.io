# *args = arguments 

def add(*args):
    total = 0
    for n in args:
        total += n
    return total
print(add(3, 5))
print(add(1, 2, 3, 4, 5))