# index operators = give access to a sequence's element (str, list, tuples)

name = "Bro Code"
print(name[0])      # B
print(name[4])      # C
print(name[-1])     # e
print(name[-3])     # o
print(name[0:3])    # Bro (includes 0, excludes 3)
print(name[3:])     # Code (includes 3, goes to end)
print(name[:3])     # Bro (starts at beginning, excludes 3)
print(name[0:8:2])  # B o o (includes 0, excludes 8, step 2)
print(name[::2])    # B o o (starts at beginning, goes to end, step 2)
# strings are immutable - cannot change characters
# name[0] = "P"  # this will cause an error
# to change a string, we need to create a new string
name = "P" + name[1:]
print(name)         # Pro Code
# lists are mutable - can change elements
food = ["pizza", "hamburger", "hotdog"]
food[0] = "sushi"
print(food)        # ['sushi', 'hamburger', 'hotdog']
# tuples are immutable - cannot change elements
student = ("Bro", 21, "Male")
# student[0] = "Sis"  # this will cause an error
# to change a tuple, we need to create a new tuple
student = ("Sis",) + student[1:]
print(student)     # ('Sis', 21, 'Male)
