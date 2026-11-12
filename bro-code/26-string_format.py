# str.format = format method of string objects

animal = "cat"
item = "cheese"

print("The {} jumped over the moon".format(animal))
print("The {} is eating {}".format(animal, item))
print("The {1} is eating {0}".format(item, animal))
print("The {animal} jumped over the {item}".format(animal="dog", item="fence"))
print("The {animal} jumped over the {item}".format(item="fence", animal="dog"))