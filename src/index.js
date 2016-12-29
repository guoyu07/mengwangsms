import soap from 'soap';
import _ from 'lodash';

const ERROR_FORMAT = 601;

class Mengwang {
  static errMap = {
    '-1': '参数为空。信息、电话号码等有空指针，登陆失败',
    '-2': '电话号码个数超过100',
    '-3': '未知原因',
    '-10': '申请缓存空间失败',
    '-11': '电话号码中有非数字字符',
    '-12': '有异常电话号码',
    '-13': '电话号码个数与实际个数不相等',
    '-14': '实际号码个数超过100',
    '-101': '发送消息等待超时',
    '-102': '发送或接收消息失败',
    '-103': '接收消息超时',
    '-200': '其他错误',
    '-999': 'web服务器内部错误',
    '-10001': '用户登陆不成功',
    '-10002': '提交格式不正确',
    '-10003': '用户余额不足',
    '-10004': '手机号码不正确',
    '-10005': '计费用户帐号错误',
    '-10006': '计费用户密码错',
    '-10007': '账号已经被停用',
    '-10008': '账号类型不支持该功能',
    '-10009': '其它错误',
    '-10010': '企业代码不正确',
    '-10011': '信息内容超长',
    '-10012': '不能发送联通号码',
    '-10013': '操作员权限不够',
    '-10014': '费率代码不正确',
    '-10015': '服务器繁忙',
    '-10016': '企业权限不够',
    '-10017': '此时间段不允许发送',
    '-10018': '经销商用户名或密码错',
    '-10019': '手机列表或规则错误',
    '-10021': '没有开停户权限',
    '-10022': '没有转换用户类型的权限',
    '-10023': '没有修改用户所属经销商的权限',
    '-10024': '经销商用户名或密码错',
    '-10025': '操作员登陆名或密码错误',
    '-10026': '操作员所充值的用户不存在',
    '-10027': '操作员没有充值商务版的权限',
    '-10028': '该用户没有转正不能充值',
    '-10029': '此用户没有权限从此通道发送信息',
    '-10030': '不能发送移动号码',
    '-10031': '手机号码(段)非法',
    '-10032': '用户使用的费率代码错误',
    '-10033': '非法关键词'
  };

  constructor({
    wsdl,
    pszSubPort,
    username,
    userpass,
    proxy,
    timeout,
    debug = process.env.NODE_DEBUG && /\bmengwang\b/.test(process.env.NODE_DEBUG),
    logger = _.noop
  }) {
    this._pszSubPort = pszSubPort;
    this._username = username;
    this._userpass = userpass;
    this._proxy = proxy;
    this._timeout = timeout;
    this._debug = debug;
    this._logger = logger;
    this.deferClient = new Promise((resolve, reject) => {
      soap.createClient(wsdl, {
        wsdl_options: {
          proxy,
          timeout
        }
      }, (err, client) => {
        if (err) {
          this._logger(`Create client failed. err[${err.message}]`);
          reject(err);
          return;
        }

        resolve(client);
      });
    });
  }

  sendSms(mobiles, content) {
    if (!_.isArray(mobiles)) {
      mobiles = [mobiles];
    }

    if (mobiles.length === 0 || !content) {
      return Promise.reject('mobile or content empty');
    }

    let logMsg = '';
    if (this._debug) {
      logMsg += `mobile[${mobiles.join(',')}] content[${content}]`;
    }

    return this.deferClient.then((client) => {
      this._logger(`Call mengwang sendSms.${logMsg}`);
      const startTime = Date.now();

      return new Promise((resolve, reject) => {
        client.MongateCsSpSendSmsNew({
          userId: this._username,
          password: this._userpass,
          pszMobis: mobiles.join(','),
          pszMsg: content,
          iMobiCount: mobiles.length,
          pszSubPort: this._pszSubPort
        }, (err, result) => {
          this._logger(`Call mengwang complete. elapsedTime[${Date.now() - startTime}]${logMsg}`);
          if (err) {
            this._logger(`Call mengwang sendSms failed. err[${err.message}]${logMsg}`);
            reject(err);
            return;
          }
          let response = result;
          if (_.isArray(result)) {
            response = result[0];
          }

          if (this._debug) {
            logMsg += ` result[${JSON.stringify(response)}]`;
          }

          const code = response ? response.MongateCsSpSendSmsNewResult : -3;
          if (Mengwang.errMap.indexOf(code) < 0) {
            this._logger(`Call mengwang sendSms succ.${logMsg}`);
            resolve({msgid: code});
          } else {
            let errMsg = 'unknow error';
            if (Mengwang.errMap[code]) {
              errMsg = Mengwang.errMap[code];
            }
            this._logger(`Call mengwang sendSms err. err[${errMsg}]${logMsg}`);
            reject(errMsg);
          }
        }, {
          proxy: this._proxy,
          timeout: this._timeout
        });
      });
    }, (e) => {
      this._logger(`Get mengwang client failed. err[${e.message}]${logMsg}`);
      throw e;
    });
  }

  queryReport() {
    return this.deferClient.then((client) => {
      this._logger('Call mengwang queryReport.');
      const startTime = Date.now();
      return new Promise((resolve, reject) => {
        client.MongateGetDeliver({
          userId: this._username,
          password: this._userpass,
          iReqType: 2
        }, (err, result) => {
          this._logger(`Call mengwang queryReport complete. elapsedTime[${Date.now() - startTime}]`);
          if (err) {
            this._logger(`Call mengwang queryReport failed. err[${err.message}]`);
            reject(err);
            return;
          }

          const response = result;
          if (response && typeof response.MongateGetDeliverResult === 'undefined') {
            this._logger('Call mengwang queryReport failed. err[response.string is undefined]');
            reject({
              code: ERROR_FORMAT,
              message: 'response.string is undefined.'
            });
            return;
          }

          let reports = null;
          if (response === null
            || response.MongateGetDeliverResult === null
            || response.MongateGetDeliverResult.string === null
          ) {
            reports = [];
          } else if (_.isArray(response.MongateGetDeliverResult.string)) {
            reports = response.MongateGetDeliverResult.string;
          } else {
            reports = [response.MongateGetDeliverResult.string];
          }

          const smsRecords = [];
          reports.forEach((report) => {
            const [, reportTime, msgid, , mobile, , , code, status] = report.split(',');
            smsRecords.push({
              msgid,
              mobile,
              reportTime,
              code,
              status
            });
          });
          resolve({smsRecords});
        }, {
          proxy: this._proxy,
          timeout: this._timeout
        });
      });
    });
  }
}

export default Mengwang;
