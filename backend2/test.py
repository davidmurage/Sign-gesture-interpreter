import cv2
import mediapipe as mp
import numpy as np
import math
import tensorflow as tf

# Initialize mediapipe for hand detection
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(max_num_hands=1)
mp_draw = mp.solutions.drawing_utils

# Load the pre-trained classification model
model = tf.keras.models.load_model("Model/keras_model.h5")

# Read the labels
with open("Model/labels.txt", "r") as f:
    labels = [line.strip() for line in f.readlines()]

cap = cv2.VideoCapture(0)
offset = 20
imgSize = 300

while True:
    success, img = cap.read()
    if not success:
        break

    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    result = hands.process(img_rgb)
    img_output = img.copy()

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
            img_crop = img[y_min:y_max, x_min:x_max]
            img_crop_shape = img_crop.shape

            aspect_ratio = (y_max - y_min) / (x_max - x_min)

            img_white = np.ones((imgSize, imgSize, 3), np.uint8) * 255

            if aspect_ratio > 1:
                k = imgSize / (y_max - y_min)
                w_cal = math.ceil(k * (x_max - x_min))
                img_resize = cv2.resize(img_crop, (w_cal, imgSize))
                w_gap = math.ceil((imgSize - w_cal) / 2)
                img_white[:, w_gap:w_cal + w_gap] = img_resize
            else:
                k = imgSize / (x_max - x_min)
                h_cal = math.ceil(k * (y_max - y_min))
                img_resize = cv2.resize(img_crop, (imgSize, h_cal))
                h_gap = math.ceil((imgSize - h_cal) / 2)
                img_white[h_gap:h_cal + h_gap, :] = img_resize

            # Prediction
            img_white_expanded = np.expand_dims(img_white, axis=0)
            prediction = model.predict(img_white_expanded)
            index = np.argmax(prediction)
            
            cv2.rectangle(img_output, (x_min - offset, y_min - offset - 70), (x_min - offset + 400, y_min - offset + 60 - 50), (0, 255, 0), cv2.FILLED)
            cv2.putText(img_output, labels[index], (x_min, y_min - 30), cv2.FONT_HERSHEY_COMPLEX, 2, (0, 0, 0), 2)
            cv2.rectangle(img_output, (x_min - offset, y_min - offset), (x_max + offset, y_max + offset), (0, 255, 0), 4)

            cv2.imshow('ImageCrop', img_crop)
            cv2.imshow('ImageWhite', img_white)

    cv2.imshow('Image', img_output)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
