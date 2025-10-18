const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

const toUserTZ = (date, tz) => {
    if (!date) return null;
    try {
        return dayjs(date).tz(tz).toDate();
    } catch (error) {
        console.warn('Failed to convert date to user timezone, falling back to UTC value.', { tz, error });
        return dayjs(date).toDate();
    }
};

const fromUserTZ = (date, tz) => {
    // date is in user's timezone, convert to UTC for storage
    if (!date) return null;
    try {
        return dayjs.tz(date, tz).utc().toDate();
    } catch (error) {
        console.warn('Failed to parse user timezone date, assuming input is UTC.', { tz, error });
        return dayjs(date).utc().toDate();
    }
};

const formatInTZ = (date, tz, format = undefined) => {
    if (!date) return null;
    try {
        return format ? dayjs(date).tz(tz).format(format) : dayjs(date).tz(tz).toString();
    } catch (error) {
        console.warn('Failed to format date in timezone, falling back to default format.', { tz, error });
        return format ? dayjs(date).format(format) : dayjs(date).toString();
    }
};

const isValidTZ = (tz) => {
    if (!tz || typeof tz !== 'string') {
        return false;
    }

    if (typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function') {
        return Intl.supportedValuesOf('timeZone').includes(tz);
    }

    try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
        return true;
    } catch (error) {
        return false;
    }
};

module.exports = { toUserTZ, fromUserTZ, formatInTZ, isValidTZ };
