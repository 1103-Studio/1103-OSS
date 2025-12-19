package util

import (
	"fmt"
	"regexp"
	"strconv"
	"time"
)

// ParseDuration 解析持续时间字符串，支持格式如 "4w", "3d", "2h30m", "1w2d3h"
// 支持的单位：w (周), d (天), h (小时), m (分钟), s (秒)
func ParseDuration(s string) (time.Duration, error) {
	if s == "" {
		return 0, fmt.Errorf("empty duration string")
	}

	// 正则匹配数字+单位的模式
	re := regexp.MustCompile(`(\d+)([wdhms])`)
	matches := re.FindAllStringSubmatch(s, -1)

	if len(matches) == 0 {
		return 0, fmt.Errorf("invalid duration format: %s", s)
	}

	var totalDuration time.Duration

	for _, match := range matches {
		if len(match) != 3 {
			continue
		}

		value, err := strconv.ParseInt(match[1], 10, 64)
		if err != nil {
			return 0, fmt.Errorf("invalid number in duration: %s", match[1])
		}

		unit := match[2]
		switch unit {
		case "w":
			totalDuration += time.Duration(value) * 7 * 24 * time.Hour
		case "d":
			totalDuration += time.Duration(value) * 24 * time.Hour
		case "h":
			totalDuration += time.Duration(value) * time.Hour
		case "m":
			totalDuration += time.Duration(value) * time.Minute
		case "s":
			totalDuration += time.Duration(value) * time.Second
		default:
			return 0, fmt.Errorf("unknown unit: %s", unit)
		}
	}

	if totalDuration == 0 {
		return 0, fmt.Errorf("duration is zero")
	}

	return totalDuration, nil
}

// FormatDuration 将 time.Duration 格式化为人类可读的字符串，如 "7d", "2h30m"
func FormatDuration(d time.Duration) string {
	if d == 0 {
		return "0s"
	}

	// 转换为秒
	seconds := int64(d.Seconds())

	weeks := seconds / (7 * 24 * 3600)
	seconds %= (7 * 24 * 3600)

	days := seconds / (24 * 3600)
	seconds %= (24 * 3600)

	hours := seconds / 3600
	seconds %= 3600

	minutes := seconds / 60
	seconds %= 60

	result := ""
	if weeks > 0 {
		result += fmt.Sprintf("%dw", weeks)
	}
	if days > 0 {
		result += fmt.Sprintf("%dd", days)
	}
	if hours > 0 {
		result += fmt.Sprintf("%dh", hours)
	}
	if minutes > 0 {
		result += fmt.Sprintf("%dm", minutes)
	}
	if seconds > 0 {
		result += fmt.Sprintf("%ds", seconds)
	}

	if result == "" {
		return "0s"
	}

	return result
}
