package dev.pranav.fitnesscompanion;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NutritionLabelScannerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
