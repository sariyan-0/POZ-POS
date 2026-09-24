package com.sariyan0.oneregister

import android.content.Context
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import kotlin.concurrent.thread

class RegisterFeedbackModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "RegisterFeedback"

  private fun vibrator(): Vibrator =
    reactApplicationContext.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator

  private fun vibrate(milliseconds: Long, amplitude: Int) {
    val service = vibrator()
    if (!service.hasVibrator()) return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      service.vibrate(VibrationEffect.createOneShot(milliseconds, amplitude))
    } else {
      @Suppress("DEPRECATION")
      service.vibrate(milliseconds)
    }
  }

  private fun waveform(timings: LongArray, amplitudes: IntArray) {
    val service = vibrator()
    if (!service.hasVibrator()) return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      service.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1))
    } else {
      @Suppress("DEPRECATION")
      service.vibrate(timings, -1)
    }
  }

  private fun playTone(tone: Int, duration: Int, volume: Int = 42) {
    thread(name = "OneRegisterFeedback") {
      val generator = ToneGenerator(AudioManager.STREAM_MUSIC, volume)
      try {
        generator.startTone(tone, duration)
        Thread.sleep(duration.toLong() + 30L)
      } finally {
        generator.release()
      }
    }
  }

  @ReactMethod
  fun haptic(style: String) {
    when (style) {
      "selection" -> vibrate(7L, 42)
      "warning" -> waveform(longArrayOf(0L, 18L, 45L, 26L), intArrayOf(0, 85, 0, 125))
      else -> vibrate(11L, 65)
    }
  }

  @ReactMethod
  fun paymentSuccess() {
    waveform(longArrayOf(0L, 20L, 42L, 32L), intArrayOf(0, 70, 0, 115))
    playTone(ToneGenerator.TONE_PROP_ACK, 180, 46)
  }

  @ReactMethod
  fun paymentFailure() {
    waveform(longArrayOf(0L, 34L, 52L, 58L), intArrayOf(0, 120, 0, 175))
    playTone(ToneGenerator.TONE_PROP_NACK, 260, 42)
  }
}
