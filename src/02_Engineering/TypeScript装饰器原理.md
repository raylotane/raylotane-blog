## 概述
> 随着TypeScript和ES6里引入了类，在一些场景下我们需要额外的特性来支持标注或修改类及其成员。 装饰器（Decorators）为我们在类的声明及成员上通过元编程语法添加标注提供了一种方式。 Javascript里的装饰器目前处在 [建议征集的第二阶段](https://github.com/tc39/proposal-decorators)，**但在TypeScript里已做为一项实验性特性予以支持。**
>

### 装饰器的使用
首先需要配置 **`tsconfig.json`** **启用装饰器实验特性**

```markdown
{
    "compilerOptions": {
        "target": "ES5",
        "experimentalDecorators": true
    }
}
```



装饰器是一种特殊类型的声明，它能够被附加到[类声明](https://www.tslang.cn/docs/handbook/decorators.html#class-decorators)，[方法](https://www.tslang.cn/docs/handbook/decorators.html#method-decorators)， [访问符](https://www.tslang.cn/docs/handbook/decorators.html#accessor-decorators)，[属性](https://www.tslang.cn/docs/handbook/decorators.html#property-decorators)或[参数](https://www.tslang.cn/docs/handbook/decorators.html#parameter-decorators)上。 装饰器使用`@expression`这种形式，`expression`**求值后必须为一个函数，它会在运行时被调用，被装饰的声明信息做为参数传入**。

```markdown
function f() {
    console.log("f(): Factory");
    return function (target, propertyKey: string, descriptor: PropertyDescriptor) {
        console.log("f(): called");
    }
}

function g() {
    console.log("g(): Factory");
    return function (target, propertyKey: string, descriptor: PropertyDescriptor) {
        console.log("g(): called");
    }
}

class C {
    @f()
    @g()
    method() {}
}
```

```markdown
f(): evaluated
g(): evaluated
g(): called
f(): called
```



## 装饰器原理
### 总结
装饰器可以在类、方法、属性三个维度使用，每个维度有其特定的使用场景。

装饰器**求值后必须为一个函数，它会在运行时被调用，被装饰的声明信息做为参数传入**。

装饰器工厂的代码依据从上到下执行，装饰器从下往上一次执行——从里往外的设计思想

```markdown
function f() {
    console.log("f(): Factory");
    return function (target, propertyKey: string, descriptor: PropertyDescriptor) {
        console.log("f(): called");
    }
}

function g() {
    console.log("g(): Factory");
    return function (target, propertyKey: string, descriptor: PropertyDescriptor) {
        console.log("g(): called");
    }
}

class C {
    @f()
    @g()
    method() {}
}
```

```markdown
f(): Factory
g(): Factory
g(): called
f(): called
```

### 类
#### 实现-类成员属性验证器
```typescript
const Validate = (ctor: any) => {
  // ctor 被装饰的类（构造函数）
  ctor.prototype.validate = function () {
    if (this.name === undefined || this.name === null || this.name === '') {
      return ['name 不能为空']
    }
    return []
  }
}

interface Person {
  validate(): string[]
}

@Validate
class Person {
  constructor(public name: string) {
    this.name = name
  }
}

// --- 校验演示 ---
console.log('--- 校验 name ---\n')
console.log('① name 为空：', new Person('').validate())
console.log('② name 不为空：', new Person('raloy').validate())
```

#### 总结
类装饰器核心能力是「替换或增强整个类」。类装饰器的参数是构造函数本身，不是实例。

### 属性
### 实现-属性装饰器
```typescript


interface Person {
  validate(): string[]
}

/
 * 单条校验规则：接收属性值，返回错误信息（null 表示通过）
 */
type Validator = (value: any) => string | null;

interface Rule {
  propertyKey: string;
  validate: Validator;
}

/
 * 把 validate 方法动态注入到类的原型上（每个类只注入一次）
 * 这样使用者就不需要在类里手写 validate 了
 */
const installValidate = (target: any) => {
  // 已有则不覆盖：兼容“使用者自己想手写 validate”的情况
  if (typeof target.validate === 'function') return;
  Object.defineProperty(target, 'validate', {
    value: function (this: any) {
      const rules = ((this.constructor as any).rules ?? []) as Rule[];
      return rules
        .map((rule) => rule.validate(this[rule.propertyKey]))
        .filter((msg: string | null): msg is string => msg !== null);
    },
    enumerable: false, // 不会被 for...in、Object.keys 枚举到
    writable: true,
    configurable: true,
  });
}

/
 * 取出所属类的规则集合（挂在构造函数上，只创建一次）
 */
const getRules = (target: any): Rule[] => {
  const ctor = target.constructor;
  // 用 hasOwnProperty 判断，避免子类“继承”到父类的数组
  if (!Object.prototype.hasOwnProperty.call(ctor, 'rules')) {
    ctor.rules = [] as Rule[];
  }
  return ctor.rules as Rule[];
}

/
 * 类装饰器：把 validate 方法注入到类的原型上
 *
 * 为什么类装饰器比“属性装饰器里顺手注入”更合适？
 * 装饰器的执行顺序是：先所有成员装饰器（自下而上），最后才是类装饰器。
 * 所以类装饰器执行时，rules 一定已经收集完毕，时机最稳妥。
 *
 * @param ctor 被装饰的类（构造函数）
 */
const Validate = <T extends new (...args: any[]) => any>(ctor: T) => {
  installValidate(ctor.prototype);
}

/
 * 注册一条校验规则（供各验证器装饰器调用）
 * 职责单一：只收集规则，注入方法交给 @Validate 类装饰器
 */
const addRule = (target: any, propertyKey: string, validate: Validator) => {
  getRules(target).push({ propertyKey, validate });
}

/
 * 属性装饰器：必填校验
 * 注意属性装饰器只有 (target, propertyKey) 两个参数，拿不到 descriptor，
 * 因此只能在装饰阶段“收集规则”，等到实例上调用 validate() 时再统一执行。
 */
const required = (target: any, propertyKey: string) => {
  addRule(target, propertyKey, (value) => {
    if (value === undefined || value === null || value === '') {
      return `${propertyKey} 不能为空`;
    }
    return null;
  });
}


/
 * 属性装饰器工厂：最大长度校验
 * @param max 允许的最大长度
 */
const maxLen = (max: number) => {
  return (target: any, propertyKey: string) => {
    addRule(target, propertyKey, (value) => {
      if (typeof value === 'string' && value.length > max) {
        return `${propertyKey} 长度不能超过 ${max}（当前 ${value.length}）`;
      }
      return null;
    });
  };
}

function readonly(target: any, key: string) {
  let value: any;
  Object.defineProperty(target, key, {
    get() { return value; },
    set(v: any) {
      // 只允许设置一次
      if (value === undefined) value = v;
    },
    enumerable: true,
    configurable: true,
  });
}

@Validate
class Person {

  @readonly 
  @required
  @maxLen(10)
  name?: string;

}

const person = new Person()

// --- 校验演示 ---
// --- 校验演示 ---
console.log('--- 校验 name ---\n');

console.log('① name 为空：', person.validate());

person.name = '这是一个超过十个字符的名字';
console.log('② name 超长：', person.validate());

person.name = '张三';
console.log('③ name 合法：', person.validate());


```

#### 总结
属性装饰器因为拿不到描述符和值，能力比方法装饰器弱很多。它主要的价值是：

+ 打标记 / 存元数据（最常见，配合 reflect-metadata）
+ 通过 Object.defineProperty 手动定义访问器来间接控制属性
+ 为框架（如 ORM、表单校验库）提供声明式配置

这也是为什么实际项目中属性装饰器常跟方法装饰器、类装饰器配合使用——属性装饰器负责「声明」，其他装饰器负责「处理」。

### 方法
#### 实现-日志/耗时装饰器
```typescript
/
 * 方法装饰器：计算方法执行耗时
 * @param target      类的原型对象（实例方法）或构造函数（静态方法）
 * @param key         被装饰的方法名
 * @param descriptor  属性描述符，可通过 descriptor.value 拿到原方法
 */
const measure = (target: any, key: string, descriptor: PropertyDescriptor) => {
  const original = descriptor.value;
  descriptor.value = function (...args: any[]) {
    const start = performance.now();
    const result = original.apply(this, args);
    console.log(`${key} 耗时 ${performance.now() - start}ms`);
    return result;
  };
}

/
 * 装饰器工厂：创建日志/埋点方法装饰器
 * @param tag 可选的日志标签，缺省时使用方法名作为标签
 * @returns   返回一个方法装饰器，在方法执行前后打印日志
 */
const log = (tag?: string) => {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    const original = descriptor.value;
    descriptor.value = function (...args: any[]) {
      console.log(`${tag || key} 开始执行`);
      const result = original.apply(this, args);
      console.log(`${tag || key} 执行结束`);
      return result;
    };
  };
}


class Person {
  // 装饰器自下而上求值：先应用 @log('watchTv')，再应用 @measure
  @measure
  @log('watchTv')
  watchTv() {
    console.log('watching tv');
  }
}

const person = new Person();
person.watchTv();
```

#### 总结
方法装饰器的本质能力是：拦截、替换、包装方法的执行。核心套路都一样：

1. 取出 descriptor.value（原方法）
2. 用新函数替换它
3. 新函数里可以「执行前 / 执行后」做额外的事
4. 记得 original.apply(this, args) 保持 this 正确

适合做横切关注点（cross-cutting concerns）：日志、计时、鉴权、缓存、防抖等，避免在每个方法里重复写这些代码。



