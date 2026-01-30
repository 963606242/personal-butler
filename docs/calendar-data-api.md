# 日历数据API说明

## 概述

日历服务支持从公开API获取农历、节假日、24节气等数据，并自动保存到本地，避免每次计算。

## 可用的API接口

### 1. Chinese Days API（推荐）
- **地址**: `https://chinese-days.yaavi.me/data/{year}.json`
- **示例**: `https://chinese-days.yaavi.me/data/2026.json`
- **数据格式**: JSON
- **包含内容**: 
  - 农历日期
  - 24节气
  - 节假日
  - 调休信息
- **覆盖年份**: 2004-2026

### 2. 免费节假日API（推荐 - 最完整）⭐
- **主站**: https://holiday.ailcc.com/about
- **整年数据接口**: `https://holiday.ailcc.com/api/holiday/allyear/{year}`
- **示例**: `https://holiday.ailcc.com/api/holiday/allyear/2026`
- **数据格式**: JSON
- **包含内容**: 
  - ✅ 农历日期（lunar字段，如"腊月初九"）
  - ✅ 24节气（extra_info字段）
  - ✅ 中国法定节假日与调休信息
  - ✅ 工作日/休息日标记
  - ✅ 调休和补班信息
- **特点**: 
  - 一次性获取整年数据（365/366天）
  - 数据权威，随国务院通知更新
  - 免费使用，24小时最多10000次请求
  - 必须使用HTTPS
- **其他接口**:
  - `/api/holiday/info/{date}` - 单个日期查询
  - `/api/holiday/batch?d={dates}` - 批量查询（最多50个）
  - `/api/holiday/year/{year}` - 获取年份节假日列表

### 3. 极速数据 - 万年历API
- **地址**: `https://api.jisuapi.com/calendar/`
- **免费套餐**: 100次/月
- **需要**: API Key
- **包含内容**: 农历、干支、生肖、黄历宜忌、节假日等

## 数据存储

获取的数据会自动保存到浏览器的 `localStorage` 中，键名格式为：`calendar_data_{year}`

例如：
- `calendar_data_2026` - 2026年的数据

## 数据格式示例

```json
{
  "2026-01-27": {
    "lunar": {
      "year": 2025,
      "month": 12,
      "day": 9,
      "monthName": "腊",
      "dayName": "初九",
      "fullText": "腊月初九",
      "isLeapMonth": false
    },
    "jieQi": null,
    "holidays": [],
    "isWorkDay": true
  },
  "2026-02-17": {
    "lunar": {
      "year": 2026,
      "month": 1,
      "day": 1,
      "monthName": "正",
      "dayName": "初一",
      "fullText": "正月初一",
      "isLeapMonth": false
    },
    "jieQi": null,
    "holidays": [
      {
        "name": "春节",
        "type": "lunar",
        "isOffDay": true
      }
    ],
    "isWorkDay": false
  }
}
```

## 使用方式

### 自动预加载

应用启动时会自动预加载当前年份的数据：

```javascript
// 在 Schedule.jsx 中
useEffect(() => {
  const currentYear = dayjs().year();
  calendarService.preloadYearData(currentYear);
}, []);
```

### 手动加载

```javascript
import { getCalendarService } from '../services/calendar-service';

const calendarService = getCalendarService();

// 加载指定年份的数据
await calendarService.preloadYearData(2026);
```

### 获取日期信息

```javascript
const dateInfo = calendarService.getDateInfo(new Date('2026-01-27'), {
  showLunar: true,
  showHoliday: true
});

console.log(dateInfo);
// {
//   date: "2026-01-27",
//   lunar: { ... },
//   jieQi: null,
//   holidays: [],
//   isWorkDay: true
// }
```

## 备用方案

如果API不可用或数据未加载，系统会自动使用 `lunar-javascript` 库进行实时计算，确保功能正常。

## 注意事项

1. **数据缓存**: 数据会缓存在内存和 localStorage 中，避免重复请求
2. **离线支持**: 如果API不可用，会自动切换到本地计算
3. **数据更新**: 建议每年年初更新一次数据，或使用API自动获取最新数据
4. **隐私**: 所有数据存储在本地，不会上传到服务器

## 开发建议

1. 可以在应用首次启动时预加载未来2-3年的数据
2. 定期检查并更新节假日数据（特别是调休安排）
3. 考虑添加数据更新提醒功能
