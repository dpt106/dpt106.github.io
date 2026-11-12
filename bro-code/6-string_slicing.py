name = "Sam Robinson"

first_name = name[0:3]  # [start:stop:step]
last_name = name[4:]    # from index 4 to end
step_name = name[0::2]  # every second letter

print("First three letters of the name: " + first_name)
print("Last nine letters of the name: " + last_name)
print("Every second letter of the name: " + step_name)