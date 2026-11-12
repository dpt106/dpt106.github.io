import time

for i in range(1,10+1,3):
    print("Iteration number: " + str(i))

for i in "Sam Robinson":
    print("Letter: " + i)

for seconds in range(10,0,-1):
    print("Countdown: " * str(seconds))
    time.sleep(1)