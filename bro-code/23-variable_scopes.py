# variable scopes = the region that a variable is recognized
#                   A variable is only available from inside the region it is created
def my_func():
    x = 300
    print(x)

# print(x)

y = 0
def my_func2():
    y =+ 1
    print(y)

my_func2()
print(y)