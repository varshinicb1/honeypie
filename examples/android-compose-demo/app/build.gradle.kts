plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
}

android {
  namespace = "dev.honeypie.compose.demo"
  compileSdk = 35

  defaultConfig {
    applicationId = "dev.honeypie.compose.demo"
    minSdk = 23
    targetSdk = 35
    versionCode = 1
    versionName = "1.0"
  }

  buildFeatures {
    compose = true
  }
}

dependencies {
  val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
  implementation(composeBom)
  implementation("androidx.activity:activity-compose:1.9.3")
  implementation("androidx.compose.material3:material3")
  implementation("androidx.compose.ui:ui")
  implementation("androidx.compose.ui:ui-tooling-preview")
  debugImplementation("androidx.compose.ui:ui-tooling")
}
