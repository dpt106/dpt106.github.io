# tuple = a collection which is ordered and unchangeable. Allows duplicate members.

student = ("Bron", 21, "Male")
print(student.count("Bron"))  # counts how many times "Bron" appears in the tuple
print(student.index("Male"))      # finds the index of the value 21 in the tuple

for x in student:
    print(x)

if "Bron" in student:
    print("Bron is here")