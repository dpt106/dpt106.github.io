# list = storage for multiple items in a single variable

food = ["pizza", "burger", "hotdog", "spaghetti", "pudding"]

print(food[0])      # pizza
print(food[1])      # burger
print(food[-1])     # pudding
food[0] = "sushi"
print(food[0])      # sushi
print(food[0:3])    # ['sushi', 'burger', 'hotdog']
print(food[2:])     # ['hotdog', 'spaghetti', 'pudding
print(food)         # ['sushi', 'burger', 'hotdog', 'spaghetti', 'pudding']
food.append("ice cream")   # add item to the end of the list
print(food)         # ['sushi', 'burger', 'hotdog', 'spaghetti', 'pudding', 'ice cream']
food.remove("burger")      # remove item from the
print(food)         # ['sushi', 'hotdog', 'spaghetti', 'pudding', 'ice cream']
food.pop()          # remove last item
print(food)         # ['sushi', 'hotdog', 'spaghetti', 'pudding']
food.insert(0, "cake")    # insert item at index 0
print(food)         # ['cake', 'sushi', 'hotdog', 'spaghetti', 'pudding']
food.sort()         # sort the list
print(food)         # ['cake', 'hotdog', 'pudding', 'spaghetti', 'sushi']
food.clear()        # clear the list
print(food)         # []