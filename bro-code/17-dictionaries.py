# Dictionaries = key-value pairs

capitals = {
    "USA": "Washington DC",
    "India": "New Delhi",
    "China": "Beijing",
    "Russia": "Moscow"
}

print(capitals["India"])        # prints the capital of India
print(capitals.get("Germany"))  # prints 'None' instead of error
print(capitals.keys())          # prints all the keys in the dictionary
print(capitals.values())        # prints all the values in the dictionary
print(capitals.items())         # prints all key-value pairs    
for key, value in capitals.items():
    print(key, value)
capitals.update({"Germany": "Berlin"})  # adds a new key-value pair
print(capitals)
capitals.update({"USA": "New York"})    # updates the value for the key "
print(capitals)
capitals.pop("China")                   # removes the key-value pair for China
print(capitals)
capitals.clear()                        # removes all key-value pairs
print(capitals)
