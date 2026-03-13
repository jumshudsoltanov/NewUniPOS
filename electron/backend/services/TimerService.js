const OrdersModel = require("../model/OrdersModel");
const TablesModel = require("../model/TablesModel");

/**
 * TimerService handles the logic for timer-based pricing calculation and management.
 */
class TimerService {
  /**
   * Calculates the charge for a given elapsed time and hourly price.
   * @param {number} hourlyPrice - The price per hour for the table.
   * @param {number} elapsedSeconds - The number of seconds elapsed.
   * @returns {number} - The calculated charge.
   */
  static calculateCharge(hourlyPrice, elapsedSeconds) {
    if (!hourlyPrice || elapsedSeconds <= 0) return 0;
    // Charge = (Price per hour / 3600 seconds) * elapsed seconds
    const charge = (hourlyPrice / 3600) * elapsedSeconds;
    return parseFloat(charge.toFixed(2));
  }

  /**
   * Parses the timer clock string (formatted as HH:MM:SS or just seconds stored as string)
   * into total seconds.
   * @param {string} clockStr - The clock status string from the DB.
   * @returns {number} - Total seconds.
   */
  static parseClockToSeconds(clockStr) {
    if (!clockStr) return 0;
    // If it's a simple number stored as string
    if (!isNaN(clockStr)) return parseInt(clockStr, 10);
    
    // If it's HH:MM:SS
    const parts = clockStr.split(":").map(Number);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
  }

  /**
   * Formats seconds into HH:MM:SS string.
   * @param {number} totalSeconds - Total seconds.
   * @returns {string} - HH:MM:SS
   */
  static formatSecondsToClock(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds]
      .map(v => v < 10 ? "0" + v : v)
      .join(":");
  }
  /**
   * Calculates the current live status (total seconds and charge) for a running timer.
   * @param {Object} order - The order object.
   * @param {number} hourlyPrice - Hourly price.
   * @returns {Object} - { seconds, charge, clockStr }
   */
  static calculateLiveStatus(order, hourlyPrice) {
    if (!order) return { seconds: 0, charge: 0, clockStr: "00:00:00" };
    
    let accumulatedSeconds = this.parseClockToSeconds(order.is_timer_clock);
    
    if (order.is_timer_status === 1 && order.timer_last_started_at) {
      const lastStarted = new Date(order.timer_last_started_at).getTime();
      const now = Date.now();
      const diffSeconds = Math.max(0, Math.floor((now - lastStarted) / 1000));
      accumulatedSeconds += diffSeconds;
    }
    
    const charge = this.calculateCharge(hourlyPrice, accumulatedSeconds);
    const clockStr = this.formatSecondsToClock(accumulatedSeconds);
    
    return { seconds: accumulatedSeconds, charge, clockStr };
  }
}

module.exports = TimerService;
