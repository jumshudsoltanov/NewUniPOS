const OrdersModel = require("../model/OrdersModel");
const TablesModel = require("../model/TablesModel");

/**
 * TimerService handles the logic for timer-based pricing calculation and management.
 */
class TimerService {
  /**
   * Masa üzrə saatlıq tarif (masa timeri) — yalnız table.hourly_price.
   */
  static getTableHourlyPrice(order) {
    if (!order) return 0;
    const v = parseFloat(order?.table?.hourly_price ?? 0);
    return Number.isNaN(v) ? 0 : v;
  }

  /**
   * Məhsul üzrə saatlıq cəm (məhsul timeri): Σ(hourly_price × say), hourly_price > 0 olan sətirlər.
   */
  static getProductHourlySum(order) {
    if (!order) return 0;
    let sum = 0;
    const items = order?.orders_items || [];
    for (const it of items) {
      const hp = parseFloat(it?.product?.hourly_price ?? 0);
      if (!Number.isNaN(hp) && hp > 0) {
        sum += hp * (parseFloat(it.count) || 0);
      }
    }
    return sum;
  }

  /**
   * Effektiv saatlıq: məhsul saatlığı > 0 olarsa yalnız məhsul cəmi; əks halda masa (cəmlənmir).
   */
  static getEffectiveHourlyPrice(order) {
    if (!order) return 0;
    const ps = this.getProductHourlySum(order);
    return ps > 0 ? ps : this.getTableHourlyPrice(order);
  }

  /**
   * Köhnə ad — getEffectiveHourlyPrice ilə eyni məntiq.
   */
  static getTotalTimerHourlyRate(order) {
    return this.getEffectiveHourlyPrice(order);
  }

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
    
    const elapsedMinutes = Math.max(1, Math.ceil(accumulatedSeconds / 60));
    let totalTimerCharge = 0;
    
    const items = order.orders_items || [];
    let hasProductTimer = false;
    
    for (const it of items) {
      let product_type = "";
      let timer_intervals = null;
      let hp = 0;
      let count = 0;
      
      if (it && typeof it.get === "function") {
        product_type = it.get("product_type") || (it.product && it.product.product_type) || "";
        timer_intervals = it.get("timer_intervals") || (it.product && it.product.timer_intervals) || null;
        hp = parseFloat(it.get("hourly_price") || (it.product && it.product.hourly_price) || 0);
        count = parseFloat(it.get("count")) || 0;
      } else {
        product_type = it.product_type || it.product?.product_type || "";
        timer_intervals = it.timer_intervals || it.product?.timer_intervals || null;
        hp = parseFloat(it.hourly_price || it.product?.hourly_price || 0);
        count = parseFloat(it.count || it.quantity || 0);
      }
      
      const isTimer = String(product_type).toLowerCase() === 'timer';
      if (!isTimer) continue;
      hasProductTimer = true;
      
      let itemElapsedSeconds = 0;
      let isTimerStatus = it && typeof it.get === "function" ? it.get("is_timer_status") : it.is_timer_status;
      let timerClockStr = it && typeof it.get === "function" ? it.get("is_timer_clock") : it.is_timer_clock;
      let timerLastStartedAt = it && typeof it.get === "function" ? it.get("timer_last_started_at") : it.timer_last_started_at;

      // Fallback for old orders that don't have item-level timer fields
      if (timerClockStr === undefined || timerClockStr === null) {
        itemElapsedSeconds = accumulatedSeconds;
        const itemCreated = it && typeof it.get === "function" ? it.get("created_at") : (it.created_at || it.createdAt);
        const orderCreated = order.created_at || order.createdAt;
        if (itemCreated && orderCreated) {
          const itemMs = new Date(itemCreated).getTime();
          const orderMs = new Date(orderCreated).getTime();
          if (!Number.isNaN(itemMs) && !Number.isNaN(orderMs) && itemMs > orderMs) {
            const offsetSeconds = Math.floor((itemMs - orderMs) / 1000);
            itemElapsedSeconds = Math.max(0, itemElapsedSeconds - offsetSeconds);
          }
        }
      } else {
        itemElapsedSeconds = this.parseClockToSeconds(timerClockStr);
        if (Number(isTimerStatus) === 1 && timerLastStartedAt) {
            const lastStarted = new Date(timerLastStartedAt).getTime();
            const diffSeconds = Math.max(0, Math.floor((Date.now() - lastStarted) / 1000));
            itemElapsedSeconds += diffSeconds;
        }
      }
      
      const itemElapsedMinutes = Math.max(1, Math.ceil(itemElapsedSeconds / 60));

      let intervals = timer_intervals;
      while (typeof intervals === 'string') {
        try { intervals = JSON.parse(intervals); } catch (e) { intervals = null; break; }
      }
      
      if (!intervals || !Array.isArray(intervals) || intervals.length === 0) {
        if (hp > 0) {
           totalTimerCharge += count * ((hp / 60) * itemElapsedMinutes);
        }
        continue;
      }
      
      const sorted = [...intervals].sort((a, b) => (Number(a.after) || 0) - (Number(b.after) || 0));
      let intervalCharge = 0;
      for (let i = 0; i < sorted.length; i++) {
        const cur = sorted[i];
        const next = sorted[i + 1];
        const after = Number(cur.after) || 0;
        const duration = Math.max(1, Number(cur.duration) || 1);
        const price = Number(cur.price) || 0;
    
        if (itemElapsedMinutes <= after) continue;
    
        const maxMins = next ? (Number(next.after) || 0) - after : Infinity;
        const minsInInterval = Math.min(itemElapsedMinutes - after, maxMins);
        if (minsInInterval > 0) {
          intervalCharge += Math.ceil(minsInInterval / duration) * price;
        }
      }
      
      totalTimerCharge += count * intervalCharge;
    }
    
    let charge = 0;
    if (hasProductTimer) {
      charge = parseFloat(totalTimerCharge.toFixed(2));
    } else {
      charge = this.calculateCharge(hourlyPrice, accumulatedSeconds);
    }

    const clockStr = this.formatSecondsToClock(accumulatedSeconds);
    
    // Check if any timer is running (either on the order itself or any timer item)
    let isTimerRunning = order.is_timer_status === 1;
    if (!isTimerRunning && items && items.length > 0) {
      for (const it of items) {
        let pt = it.product_type || it.product?.product_type || "";
        if (it && typeof it.get === "function") {
            pt = it.get("product_type") || (it.product && it.product.product_type) || "";
        }
        if (String(pt).toLowerCase() === 'timer') {
            const status = it && typeof it.get === "function" ? it.get("is_timer_status") : it.is_timer_status;
            if (Number(status) === 1) {
                isTimerRunning = true;
                break;
            }
        }
      }
    }
    
    return { seconds: accumulatedSeconds, charge, clockStr, isTimerRunning };
  }
}

module.exports = TimerService;
