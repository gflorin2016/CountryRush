plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "ro.countryrush.live"
    compileSdk = 34
    defaultConfig {
        applicationId = "ro.countryrush.live"
        minSdk = 24
        targetSdk = 34
        versionCode = 5
        versionName = "5.0"
    }
    buildTypes { release { isMinifyEnabled = false } }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    androidResources { noCompress += listOf("mp3") }
}
dependencies {
    implementation("androidx.webkit:webkit:1.11.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
}
