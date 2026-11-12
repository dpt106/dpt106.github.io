# nested function calls = function calls inside other function calls

num = input("Enter a whole number: ")
num = float(num)
num = abs(num)
num = round(num)
print(num)

# can be simplified to:
print(round(abs(float(input("enter a whole number: ")))))
