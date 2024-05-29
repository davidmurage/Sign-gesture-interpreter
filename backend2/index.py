from flask import Flask, request, jsonify
import cv2
import numpy as np
import tensorflow as tf

app = Flask(__name__)

# Load your pre-trained model (make sure to replace 'model.h5' with your model's filename)
model = tf.keras.models.load_model('Model/keras_model.h5', 'Model/labels.txt')

@app.route('/predict', methods=['POST'])
def predict():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'})
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'})
    
    # Read the image via file.stream
    img = np.fromstring(file.read(), np.uint8)
    img = cv2.imdecode(img, cv2.IMREAD_COLOR)

    # Preprocess the image (resize, normalize, etc.)
    img = cv2.resize(img, (64, 64))  # Resize to the input size of the model
    img = img / 255.0  # Normalize
    img = np.expand_dims(img, axis=0)  # Add batch dimension

    # Predict
    prediction = model.predict(img)
    predicted_class = np.argmax(prediction, axis=1)

    return jsonify({'prediction': str(predicted_class[0])})

if __name__ == '__main__':
    app.run(debug=True)
