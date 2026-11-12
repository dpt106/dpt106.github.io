# set = collection which is unordered, unindexed. No duplicate values

utensils = {"fork", "spoon", "knife"}
dishes = {"bowl", "plate", "cup", "knife"}
print(utensils)
dinner_table = utensils.union(dishes)  # combines two sets but removes any duplicates
print(dinner_table)
print(utensils.difference(dishes))  # prints items that are only in utensils
utensils.add("napkin")  # adds item to the set
print(utensils)
utensils.remove("fork")  # removes item from the set
print(utensils) 