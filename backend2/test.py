import cv2
import mediapipe as mp
import numpy as np
import math
import tensorflow as tf

# Initialize mediapipe hand detection
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(max_num_hands=1)
mp_drawing = mp.solutions.drawing_utils

# Load the classifier model
model = tf.keras.models.load_model("Model/keras_model.h5")

# Read the labels
with open("Model/labels.txt", "r") as f:
    labels = f.read().strip().split('\n')

cap = cv2.VideoCapture(0)
offset = 20
imgSize = 300
counter = 0

while True:
    success, img = cap.read()
    imgOutput = img.copy()
    imgRGB = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    results = hands.process(imgRGB)
    
    if results.multi_hand_landmarks:
        for hand_landmarks in results.multi_hand_landmarks:
            # Get bounding box coordinates
            h, w, c = img.shape
            x_min, y_min = w, h
            x_max, y_max = 0, 0
            
            for lm in hand_landmarks.landmark:
                x, y = int(lm.x * w), int(lm.y * h)
                if x < x_min:
                    x_min = x
                if x > x_max:
                    x_max = x
                if y < y_min:
                    y_min = y
                if y > y_max:
                    y_max = y
            
            # Add offset
            x, y, w, h = x_min - offset, y_min - offset, x_max - x_min + offset * 2, y_max - y_min + offset * 2

            imgWhite = np.ones((imgSize, imgSize, 3), np.uint8) * 255

            imgCrop = img[y:y + h, x:x + w]
            imgCropShape = imgCrop.shape

            aspectRatio = h / w

            if aspectRatio > 1:
                k = imgSize / h
                wCal = math.ceil(k * w)
                imgResize = cv2.resize(imgCrop, (wCal, imgSize))
                wGap = math.ceil((imgSize - wCal) / 2)
                imgWhite[:, wGap: wCal + wGap] = imgResize
            else:
                k = imgSize / w
                hCal = math.ceil(k * h)
                imgResize = cv2.resize(imgCrop, (imgSize, hCal))
                hGap = math.ceil((imgSize - hCal) / 2)
                imgWhite[hGap: hCal + hGap, :] = imgResize

            # Preprocess imgWhite for classification
            imgWhite_resized = cv2.resize(imgWhite, (224, 224))  # Assuming the model expects 224x224 input size
            imgWhite_resized = imgWhite_resized / 255.0  # Normalize to [0, 1]
            imgWhite_resized = np.expand_dims(imgWhite_resized, axis=0)

            # Predict the class
            prediction = model.predict(imgWhite_resized)
            index = np.argmax(prediction)
            print(prediction, index)

            cv2.rectangle(imgOutput, (x-offset, y-offset-70), (x -offset+400, y - offset+60-50), (0, 255, 0), cv2.FILLED)
            cv2.putText(imgOutput, labels[index], (x, y-30), cv2.FONT_HERSHEY_COMPLEX, 2, (0, 0, 0), 2)
            cv2.rectangle(imgOutput, (x-offset, y-offset), (x + w + offset, y + h + offset), (0, 255, 0), 4)
            
            mp_drawing.draw_landmarks(imgOutput, hand_landmarks, mp_hands.HAND_CONNECTIONS)

            cv2.imshow('ImageCrop', imgCrop)
            cv2.imshow('ImageWhite', imgWhite)

    cv2.imshow('Image', imgOutput)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
