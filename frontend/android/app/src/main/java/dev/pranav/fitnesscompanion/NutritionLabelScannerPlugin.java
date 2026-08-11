package dev.pranav.fitnesscompanion;

import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import java.io.IOException;

@CapacitorPlugin(name = "NutritionLabelScanner")
public class NutritionLabelScannerPlugin extends Plugin {
    @PluginMethod
    public void recognize(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.trim().isEmpty()) {
            call.reject("An image path is required.");
            return;
        }

        final InputImage image;
        try {
            image = InputImage.fromFilePath(getContext(), Uri.parse(path));
        } catch (IOException | IllegalArgumentException exception) {
            call.reject("Could not open the captured label image.", exception);
            return;
        }

        TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        recognizer.process(image)
            .addOnSuccessListener(result -> {
                JSObject response = new JSObject();
                response.put("text", result.getText());
                call.resolve(response);
                recognizer.close();
            })
            .addOnFailureListener(exception -> {
                call.reject("Could not read text from the nutrition label.", exception);
                recognizer.close();
            });
    }
}
