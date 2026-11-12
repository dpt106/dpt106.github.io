# Strings

first_name = "Sam"
last_name = "Robinson"
full_name = first_name + " " + last_name

print("Hello "+full_name)
print(type(full_name))

# Integers

age = 30
print("I am "+str(age)+" years old")
print(type(age))

# Floats

height = 5.9
print("My height is "+str(height)+" feet")
print(type(height))

# Booleans

is_legend = False
print("Is Sam a legend? "+str(is_legend))
print(type(is_legend))

# Lists
fruits = ["apple", "banana", "cherry"]
print("Fruits: "+", ".join(fruits))
print(type(fruits))

# Dictionaries
person = {
    "first_name": first_name,
    "last_name": last_name,
    "age": age,
    "height": height,
    "is_legend": is_legend,
    "fruits": fruits
}
print("Person Info: "+str(person))
print(type(person))

# Tuples
coordinates = (10.0, 20.0)
print("Coordinates: "+str(coordinates))
print(type(coordinates))

# Sets
unique_numbers = {1, 2, 3, 4, 5}
print("Unique Numbers: "+str(unique_numbers))
print(type(unique_numbers))

# NoneType
unknown = None
print("Unknown Value: "+str(unknown))
print(type(unknown))

# Complex Numbers
complex_number = 3 + 4j
print("Complex Number: "+str(complex_number))
print(type(complex_number))

# Bytes
byte_data = b"Hello"
print("Byte Data: "+str(byte_data))
print(type(byte_data))
# Bytearray
byte_array = bytearray(5)
print("Byte Array: "+str(byte_array))
print(type(byte_array))
# Range
number_range = range(1, 10)
print("Number Range: "+str(list(number_range)))
print(type(number_range))
