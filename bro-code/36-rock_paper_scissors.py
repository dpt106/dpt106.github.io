import random

while True:
    options = ["rock", "paper", "scissors"]
    user_input = input("Type rock/paper/scissors or q to quit: ")
    
    if user_input == 'q':
        break
    if user_input not in options:
        print(user_input, "is not a valid option. Please try again.")
        continue
    
    computer_choice = random.choice(options)
    print("Computer chose:", computer_choice)

    if user_input == computer_choice:
        print("It's a tie!")
    elif (user_input == "rock" and computer_choice == "scissors") or \
            (user_input == "paper" and computer_choice == "rock") or \
            (user_input == "scissors" and computer_choice == "paper"):
        print("You win!")
    else:
        print("You lose!")

print("Thanks for playing!")