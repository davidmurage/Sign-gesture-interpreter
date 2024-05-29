import cv2
import mediapipe as mp
import numpy as np
import math
import time

# Initialize mediapipe
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(max_num_hands=1)
mp_draw = mp.solutions.drawing_utils

cap = cv2.VideoCapture(0)
offset = 20
imgSize = 300
counter = 0

folder = "Data/Yes"

while True:
    success, img = cap.read()
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    result = hands.process(img_rgb)

    if result.multi_hand_landmarks:
        for hand_landmarks in result.multi_hand_landmarks:
            # Get bounding box coordinates
            x_min, y_min = float('inf'), float('inf')
            x_max, y_max = float('-inf'), float('-inf')
            
            for lm in hand_landmarks.landmark:
                x, y = int(lm.x * img.shape[1]), int(lm.y * img.shape[0])
                x_min = min(x_min, x)
                y_min = min(y_min, y)
                x_max = max(x_max, x)
                y_max = max(y_max, y)
            
            # Add offset
            x_min -= offset
            y_min -= offset
            x_max += offset
            y_max += offset
            
            # Crop the hand region
            imgCrop = img[y_min:y_max, x_min:x_max]
            imgCropShape = imgCrop.shape

            aspectRatio = (y_max - y_min) / (x_max - x_min)

            imgWhite = np.ones((imgSize, imgSize, 3), np.uint8) * 255

            if aspectRatio > 1:
                k = imgSize / (y_max - y_min)
                wCal = math.ceil(k * (x_max - x_min))
                imgResize = cv2.resize(imgCrop, (wCal, imgSize))
                wGap = math.ceil((imgSize - wCal) / 2)
                imgWhite[:, wGap:wCal + wGap] = imgResize
            else:
                k = imgSize / (x_max - x_min)
                hCal = math.ceil(k * (y_max - y_min))
                imgResize = cv2.resize(imgCrop, (imgSize, hCal))
                hGap = math.ceil((imgSize - hCal) / 2)
                imgWhite[hGap:hCal + hGap, :] = imgResize

            cv2.imshow('ImageCrop', imgCrop)
            cv2.imshow('ImageWhite', imgWhite)

            mp_draw.draw_landmarks(img, hand_landmarks, mp_hands.HAND_CONNECTIONS)

    cv2.imshow('Image', img)
    key = cv2.waitKey(1)
    if key == ord("s"):
        counter += 1
        cv2.imwrite(f'{folder}/Image_{time.time()}.jpg', imgWhite)
        print(counter)

cap.release()
cv2.destroyAllWindows()
