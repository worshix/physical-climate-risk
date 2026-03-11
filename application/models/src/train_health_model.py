import pandas as pd
import joblib
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix
import matplotlib.pyplot as plt
import seaborn as sns
from config import RAW_DATA_PATH, FEATURES, TARGET, MODEL_DIR, REPORT_DIR

def train_model():
    print(f"Loading data from {RAW_DATA_PATH}...")
    df = pd.read_csv(RAW_DATA_PATH)
    
    X = df[FEATURES]
    y = df[TARGET]
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print("Training Logistic Regression Classifier...")
    model = LogisticRegression(max_iter=1000, random_state=42)
    model.fit(X_train, y_train)
    
    # Evaluation
    y_pred = model.predict(X_test)
    report = classification_report(y_test, y_pred)
    print("\nClassification Report:")
    print(report)
    
    # Save report
    with open(REPORT_DIR / "training_summary.md", "w") as f:
        f.write("# Training Summary\n\n")
        f.write("## Classification Report\n")
        f.write("```\n")
        f.write(report)
        f.write("```\n")
    
    # Confusion Matrix Plot
    plt.figure(figsize=(8, 6))
    cm = confusion_matrix(y_test, y_pred)
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                xticklabels=model.classes_, yticklabels=model.classes_)
    plt.title('Confusion Matrix')
    plt.ylabel('Actual')
    plt.xlabel('Predicted')
    plt.savefig(REPORT_DIR / "confusion_matrix.png")
    
    # Save the model (joblib for python use, though we'll export to JSON for Next.js)
    joblib.dump(model, MODEL_DIR / "crop_health_model.joblib")
    print(f"Model saved to {MODEL_DIR / 'crop_health_model.joblib'}")
    
    return model

if __name__ == "__main__":
    train_model()
