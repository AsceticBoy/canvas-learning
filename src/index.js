import React, { Component } from 'react'
import PropTypes from 'prop-types'
import ReactDOM from 'react-dom'
import * as D3 from 'd3'
import { event as currentEvent } from 'd3'
import elementResize from 'element-resize-event'
import Json from './mock.js'
import './index.less'

const BOARD_HEIGHT = Math.max(document.body.clientHeight, document.documentElement.clientHeight)
const BOARD_WIDTH = Math.min(document.body.clientWidth, document.documentElement.clientWidth)

const CARD_OFFSET = 10
const K = 1 // 宽高比例系数, 目前无法绝对按着这个来，只能做到近似
const STROKE_WIDTH = 3

const severityToColor = {
  '0': 'recovery', // 恢复
  '1': 'warning', // 提醒
  '2': 'error', // 警告
  '3': 'critical'  // 紧急
}

String.prototype.toNumber = function() { return Number(this) }

D3.selection.prototype.nodes = function(){
  var nodes = new Array(this.size()), i = -1;
  this.each(function() { nodes[++i] = this; });
  return nodes;
}

const active = {} // 活动对象
let impactDistance = 0

class DragBoard extends Component {

  static propTypes = {
    width: PropTypes.number,
    height: PropTypes.number,
    dataSource: PropTypes.array.isRequired
  }

  constructor(props) {
    super(props)
    this.renderCard = this.renderCard.bind(this)
    this.impact = this.impact.bind(this)
    this.state = {
      dataSource: props.dataSource || []
    }
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.dataSource !== this.props.dataSource) {
      this.setState({
        dataSource: nextProps.dataSource
      })
    }
  }

  componentDidMount() {
    this.renderCard()
  }

  componentDidUpdate() {
    this.renderCard()
  }

  // 用来计算方块的宽和高，假设现阶段面板的磁铁峰值为300
  // k -> 比例系数 a -> rect width b -> rect height c -> offset
  // H -> 画布高度 W -> 画布宽度    m -> 每行几个     n -> 有几行   L -> 磁铁个数
  // 得出等式：
  // a = bk
  // (m + 1) * c + ma = W     =>     m = w - c / c + a 
  // (n + 1) * c + nb = H     =>     n = H - c / b + c
  // mn >= L < 300    =>    (w - c) / (bk + c) * (H - c) / (b + c) >= L < 300
  // 根据测试发现：m 和 n 必须有一个固定，因为二者皆需要为整数，所以必须在当前布局下，求最优解
  /**
   * 
   * @param { Object } board SVG画布的宽高
   * @param { Number } k 比例系数
   * @param { Number } offset 方块间距，假设都一致 
   * @param { Number } len 磁铁个数
   */
  computeRect(board, k, offset, len) {
    let c = offset, l = len, w = board.width, h = board.height;
    // 这是一元二次的求根公式
    let A = l * k, B = l * k * c + c * l, C = (l - 1) * Math.pow(c, 2) - w * h + w * c + c * h
    let X1 = ( - B + Math.sqrt((Math.pow(B, 2) - 4 * A * C)) ) / (2 * A)
    let X2 = ( - B - Math.sqrt((Math.pow(B, 2) - 4 * A * C)) ) / (2 * A)
    let X = X1 > X2 ? X1 : X2
    let m = (board.width - offset) / (X * k + offset) // 小数
    let n = (board.height - offset) / (X + offset) // 小数
    // 因为 m 和 n 必须为整数，所以需要求出最优解
    if (Math.ceil(m) * Math.floor(n) >= l) {
      return {
        rowCount: Math.ceil(m),
        height: (h - (Math.floor(n) + 1) * c) / Math.floor(n),
        width: (w - (Math.ceil(m) + 1) * c) / Math.ceil(m)
      }
    }
    if (Math.floor(m) * Math.ceil(n) >= l) {
      return {
        rowCount: Math.floor(m),
        height: (h - (Math.ceil(n) + 1) * c) / Math.ceil(n),
        width: (w - (Math.floor(m) + 1) * c) / Math.floor(m)
      }
    }
    return {
      rowCount: Math.ceil(m),
      height: (h - (Math.ceil(n) + 1) * c) / Math.ceil(n),
      width: (w - (Math.ceil(m) + 1) * c) / Math.ceil(m)
    }
  }

  

  computeRectXY(rect, offset, index) {
    const quotient = Math.floor(index / rect.rowCount)
    const remainder = Math.floor(index % rect.rowCount)

    return {
      x: (remainder + 1) * offset + remainder * rect.width,
      y: (quotient + 1) * offset + quotient * rect.height,
    }
  }

  renderCard() {
    const boardHeight = this.props.height || BOARD_HEIGHT
    const boardWidth = this.props.width || BOARD_WIDTH
    const dataSource = this.state.dataSource || []

    const rect = this.computeRect({ width: boardWidth, height: boardHeight }, K, CARD_OFFSET, dataSource.length)

    this.board = D3.select('#dragBoard')
      .append('svg:svg')
      .attr('height', boardHeight)
      .attr('width', boardWidth)
    // 创建滤镜
    this.filter = this.board.append('defs:defs').append('filter:filter').attr('x', 0).attr('y', 0).attr('id', 'offset')
    this.filter.append('feOffset').attr('in', 'offOn').attr('result', 'offOut').attr('dx', STROKE_WIDTH - 1).attr('dy', STROKE_WIDTH - 1)
    this.filter.append('feBlend').attr('in', 'offOn').attr('in2', 'offOut').attr('mode', 'normal')

    let cards = this.board.selectAll('g.drag-board-card')
      .data(dataSource)

    cards.enter()
      .append('g:g')
      .attr('class', 'drag-board-card')
      .append('rect')
      .attr('stroke-width', STROKE_WIDTH)
      .attr('stroke', '#ccc')
      .attr('filter', 'url(#offset)')
      .attr('rx', 10)
      .attr('ry', 10)
      .attr('class', d => severityToColor[d.severity])
      .attr('height', rect.height)
      .attr('width', rect.width)
      .style('opacity', '1')
    // 移除空白的
    cards.exit().remove()

    // 初始动画
    this.board.selectAll('g.drag-board-card').transition()
      .duration(500)
      .attr('transform', (d, i) => {
        let translate = this.computeRectXY(rect, CARD_OFFSET, i)
        return "translate(" + translate.x + ", " + translate.y + ")"
      })
    
    // 绑定拖动事件
    D3.selectAll('.drag-board-card')
      .call(this.dragCard())
  }

  // 元素碰撞，如果是相撞了返回x,y 否则返回false
  impact(node, offsetX, offsetY) {
    // 方块A原始位置 + 鼠标偏移量
    const nodeAWidth = active.width
    const nodeAHeight = active.height
    const nodeALeft = offsetX
    const nodeATop = offsetY
    // 方块B
    const rectSelection = D3.select(node).select('rect')
    const translate = D3.transform(D3.select(node).attr("transform")).translate
    const nodeBWidth = rectSelection.attr('width').toNumber()
    const nodeBHeight = rectSelection.attr('height').toNumber()
    const nodeBLeft = translate[0]
    const nodeBTop = translate[1]
    if (
      (nodeAWidth + nodeALeft) < nodeBLeft ||
      (nodeAHeight + nodeATop) < nodeBTop ||
      (nodeBWidth + nodeBLeft) < nodeALeft ||
      (nodeBHeight + nodeBTop) < nodeATop
    ) {
      return false
    }
    return {
      x: nodeBLeft,
      y: nodeBTop
    }
  }

  // 利用勾股定理算出碰撞直线距离
  distance(x, y, offsetX, offsetY) {
    let a = offsetX - x
    let b = offsetY - y
    return Math.sqrt(Math.pow(a, 2) + Math.pow(b, 2))
  }

  // 检测碰撞
  detect(offsetX, offsetY) {
    currentEvent.sourceEvent.stopPropagation()
    D3.selectAll('g.drag-board-card')
      .call((allNodesSelection) => {
        for (let node of allNodesSelection.filter(d => d.id !== active.nodeData.id).nodes()) {
          let nodeXY = this.impact(node, offsetX, offsetY) 
          // 碰撞到了
          if (nodeXY) {
            let distance = this.distance(nodeXY.x, nodeXY.y, offsetX, offsetY) // 有可能有碰到多个的情况
            console.log(1)
            if (impactDistance) {
              if (impactDistance > distance) {
                // console.log(node)
              }
            } else {
              impactDistance = distance
            }
          }
        }
      })
  }

  dragCard() {
    let _this = this
    return D3.behavior.drag()
      .on('dragstart', function (d) {
        const rectSelection = D3.select(this).select('rect')
        const translate = D3.transform(D3.select(this).attr("transform")).translate
        // 1.确定初始的鼠标位置，后面移动需要依据这个来transform
        currentEvent.sourceEvent.stopPropagation()
        active.mouseToX = currentEvent.sourceEvent.x
        active.mouseToY = currentEvent.sourceEvent.y
        active.width = rectSelection.attr('width').toNumber()
        active.height = rectSelection.attr('height').toNumber()
        active.x = translate[0]
        active.y = translate[1]
        active.nodeData = d
      })
      .on('drag', function () {
        // 1.利用transform实现拖动
        // 2.碰撞检测
        currentEvent.sourceEvent.stopPropagation()
        
        let translateX = currentEvent.sourceEvent.x - active.mouseToX + active.x
        let translateY = currentEvent.sourceEvent.y - active.mouseToY + active.y
    
        D3.select(this)
          .attr("transform", "translate(" + translateX + ", " + translateY + ")")
          .call(function () {
            _this.detect(translateX, translateY)
          })
      })
      .on('dragend', function (d) {
        // 1.
        currentEvent.sourceEvent.stopPropagation()
      })
  }

  render() {
    return (
      <div id="dragBoard" className='drag-board'></div>
    )
  }
}

const app = document.body.querySelector('#app')

ReactDOM.render(
  <DragBoard 
    width={1000}
    height={500}
    dataSource={Json}
    dragEnd={() => {}}
  />,
app)