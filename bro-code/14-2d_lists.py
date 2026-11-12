# 2d lists = lists of lists

drinks = ["coffee", "soda", "tea"]
dinner = ["pizza", "hamburger", "hotdog"]
dessert = ["cake", "ice cream"]
food = [drinks, dinner, dessert]
print(food)
print(food[0])        # prints the first list (drinks)
print(food[0][1])     # prints "soda"