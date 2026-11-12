# break = exit loop immediately
# continue = skip to the next iteration of the loop
# pass = does nothing, placeholder

while True:
    name = input("Enter your name: ")
    if name!="":
        break

phone_number = "01632 960 000"

for i in phone_number:
    if i==" ":
        continue
    print(i, end="")

for i in range(1,21):
    if i==13:
        pass
    else:
        print(i)