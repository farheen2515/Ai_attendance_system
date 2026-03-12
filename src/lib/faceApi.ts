import * as faceapi from '@vladmandic/face-api';

const MODEL_URL = 'https://cdn.jsdelivr.net/gh/vladmandic/face-api/model/';

export const loadModels = async () => {
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
  ]);
};

export const getFaceDescriptor = async (image: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement) => {
  const detection = await faceapi
    .detectSingleFace(image)
    .withFaceLandmarks()
    .withFaceDescriptor();
  
  return detection ? detection.descriptor : null;
};

export const createFaceMatcher = (students: any[]) => {
  const labeledDescriptors = students
    .filter(s => s.face_encodings)
    .map(s => {
      const descriptors = JSON.parse(s.face_encodings).map((d: any) => {
        // Handle both object format and array format
        const values = Array.isArray(d) ? d : Object.values(d);
        return new Float32Array(values);
      });
      return new faceapi.LabeledFaceDescriptors(s.id, descriptors);
    });

  if (labeledDescriptors.length === 0) return null;
  return new faceapi.FaceMatcher(labeledDescriptors, 0.6);
};
